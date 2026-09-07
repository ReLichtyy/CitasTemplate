# 09 · Confirmación de cita por WhatsApp

Vive junto a `notificaciones.module.ts`. Da por sabidas las invariantes de
`apiBase/CLAUDE.md` y las reglas de reserva de `02-reservas-concurrencia.md`.

## Qué resuelve

Una cita nace `PENDIENTE`. Alguien tiene que confirmarla, y hoy ese alguien es el
personal llamando por teléfono. Este módulo mueve esa confirmación al cliente: recibe
un WhatsApp, toca un enlace, la cita pasa a `CONFIRMADA` sin que nadie del negocio
intervenga.

Qué **no** resuelve: no es un canal de conversación, no responde preguntas, no
reemplaza el WhatsApp normal del negocio. Manda avisos salientes y acepta una única
acción de vuelta.

## Las dos decisiones que ordenan todo lo demás

### 1 · La confirmación es un enlace firmado, no una respuesta de texto

El flujo obvio es "el cliente contesta CONFIRMAR y el webhook mueve la cita". Se
descarta como mecanismo principal por tres razones, en orden de gravedad:

- **Ambigüedad de destino.** Un cliente con dos citas pendientes que escribe
  "confirmar" no dice cuál. No hay forma honesta de adivinarlo, y adivinar mal
  confirma la cita equivocada.
- **El parseo de texto libre no tiene fondo.** "si", "sí", "ok", "dale", "confirmo",
  "👍", "Confirmar." — cada variante que no reconoces es un cliente que cree haber
  confirmado y no lo hizo. El fallo es silencioso para las dos partes.
- **Ata el dominio al canal.** Si mañana se agrega SMS o correo, la confirmación por
  texto no se reutiliza; un enlace sí.

El enlace lleva un token opaco que identifica **una cita concreta**. Sin ambigüedad,
sin parseo, y el mismo mecanismo sirve para cualquier canal futuro.

La respuesta de texto queda como comodidad opcional, nunca como el único camino. Ver
la sección de WAHA.

### 2 · El envío es un puerto, no una dependencia

`whatsapp.gateway.ts` declara la interfaz —`enviar(destino, plantilla, variables)`— y
nada más. `integrations/waha/waha.client.ts` es una implementación de esa interfaz.

Esto no es arquitectura por gusto. WAHA maneja una sesión de WhatsApp Web por
ingeniería inversa: **viola los términos de servicio de WhatsApp y el riesgo de baneo
es del número del negocio, no del servidor**. Es una decisión tomada con eso sabido,
y la salida tiene que estar construida de antemano: el día que haya que migrar a la
Cloud API oficial de Meta, se escribe un segundo adaptador y no se toca ni el outbox,
ni el worker, ni el dominio de citas.

La consecuencia de diseño es concreta: **ni `CitasService` ni el worker mencionan a
WAHA jamás.** Si el nombre "waha" aparece fuera de `integrations/waha/`, la frontera
ya se rompió.

## Frontera con el módulo de citas

`CitasService` no conoce este módulo. No lo importa, no lo llama, no espera nada de
él. Lo único que hace es dejar una fila en el outbox dentro de la transacción que ya
tenía.

Al revés sí: este módulo cambia el estado de una cita al confirmar, y lo hace pasando
por el servicio de citas, no escribiendo la fila a mano. El invariante de
`slotOcupado` (`02-reservas-concurrencia.md`) vale igual aquí — `CONFIRMADA` bloquea
disponibilidad, así que `slotOcupado` sigue valiendo `inicio`, y eso lo mantiene la
misma transacción que cambia el estado.

## El outbox

### Por qué existe

La regla dura: **la llamada HTTP a WhatsApp nunca ocurre dentro de
`prisma.$transaction`.** Dos motivos independientes, y cualquiera de los dos basta:

- Una transacción abierta sostiene locks de fila. Meterle una llamada de red le
  regala la latencia de WhatsApp a la tasa de conflictos de reserva, que es
  justamente lo que `02-reservas-concurrencia.md` trabaja para mantener corta.
- Si el envío falla y está dentro de la transacción, revienta una reserva
  perfectamente válida. El cliente pierde la cita porque el mensaje no salió. Eso es
  inaceptable: la cita es el producto, el aviso es cortesía.

Pero sacarlo de la transacción crea el problema opuesto: un envío disparado y
olvidado se pierde en el aire si WhatsApp está caído, y nadie se entera. El outbox es
lo que resuelve las dos cosas a la vez. Lo que entra en la transacción es **la
intención de enviar**, que es un `INSERT` local y barato. El envío real lo hace otro
proceso, después, y puede reintentar.

### Modelo

```prisma
enum CanalNotificacion { WHATSAPP }

enum TipoNotificacion { CONFIRMACION_CITA RECORDATORIO_CITA CANCELACION_CITA }

enum EstadoNotificacion { PENDIENTE ENVIANDO ENVIADA FALLIDA }

model NotificacionSalida {
  id     String            @id @default(uuid())
  citaId String
  tipo   TipoNotificacion
  canal  CanalNotificacion @default(WHATSAPP)

  /// Copia congelada del telefono en E.164 al momento de encolar, igual que
  /// `Cita.precioServicio`. Si el cliente cambia de numero despues, el mensaje ya
  /// encolado no debe salir a un destino que nadie eligio.
  destino   String
  variables Json

  estado           EstadoNotificacion @default(PENDIENTE)
  intentos         Int                @default(0)
  proximoIntentoEn DateTime           @default(now())
  ultimoError      String?            @db.Text
  /// Id del mensaje que devuelve el gateway. Es lo que permite conciliar un acuse
  /// de entrega con la fila que lo origino.
  idExterno        String?
  enviadaEn        DateTime?
  creadaEn         DateTime           @default(now())

  cita Cita @relation(fields: [citaId], references: [id], onDelete: Cascade)

  /// Idempotencia. Una confirmacion por cita, y no mas: sin esto, un reintento del
  /// lado del API o un doble clic encolan dos mensajes al mismo numero.
  @@unique([citaId, tipo])
  @@index([estado, proximoIntentoEn])
}
```

El esquema aplicado suma dos cosas al bloque de arriba, y las dos salen de conectar
el canal de verdad:

- `NotificacionSalida.entregadaEn`, que marca el acuse del canal y no el envio. Una
  fila `ENVIADA` sin entrega es informacion operativa: el numero puede no tener
  WhatsApp, y eso lo tiene que ver el personal.
- `model EventoWebhook`, el registro de "este evento ya se proceso". Es la
  idempotencia del webhook, que el proveedor no garantiza.

### Invariantes

1. La fila se escribe **dentro** de la misma `$transaction` que crea o cambia la
   cita. Es la única parte del envío que participa de la transacción.
2. `destino` se congela al encolar. Nunca se relee del `Usuario` al enviar.
3. `@@unique([citaId, tipo])` es la idempotencia. Encolar dos veces es un no-op, no
   un segundo mensaje.
4. Una fila `FALLIDA` es visible para el personal. Un aviso que no salió es
   información operativa, no un error de log: alguien tiene que llamar por teléfono.

## El worker

Drena el outbox. Un `@Cron` sobre el `ScheduleModule` que ya está montado en
`AppModule`.

**Es el mismo binario que el API, no un segundo proyecto.** Una variable
(`NOTIFICACIONES_WORKER=true`) decide si el cron corre. Dokploy despliega la misma
imagen dos veces con distinta configuración. Duplicar el código para tener un worker
es pagar dos veces por el mismo dominio.

Que sea un despliegue aparte tiene una consecuencia obligatoria: **el API puede
escalar a varias réplicas, así que el reclamo de trabajo tiene que ser atómico.** Dos
workers leyendo `WHERE estado = 'PENDIENTE'` a la vez mandan el mensaje dos veces.

```sql
SELECT id FROM NotificacionSalida
WHERE estado = 'PENDIENTE' AND proximoIntentoEn <= NOW()
ORDER BY proximoIntentoEn
LIMIT 20
FOR UPDATE SKIP LOCKED;
```

`SKIP LOCKED` existe en MariaDB desde 10.6 y el despliegue está fijado en 11.4, así
que se puede usar. El reclamo (`PENDIENTE → ENVIANDO`) va en una transacción corta;
el envío ocurre después, ya fuera.

Reintentos con retroceso exponencial sobre `proximoIntentoEn` — 1 min, 5, 15, 60 —
con tope. Al agotarlo, `FALLIDA`. Un mensaje reintentado para siempre contra un
número inválido es un worker que nunca avanza.

## El enlace firmado

### Forma

```
https://<dominio>/citas/confirmar/<token>
```

El token son 32 bytes aleatorios en base64url. **En la base se guarda solo su hash
SHA-256**, igual que una contraseña: quien lea la base no puede confirmar citas
ajenas.

```prisma
model TokenConfirmacion {
  /// SHA-256 del token. El token en claro solo existe dentro del enlace enviado.
  hash     String    @id
  citaId   String    @unique
  expiraEn DateTime
  usadoEn  DateTime?

  cita Cita @relation(fields: [citaId], references: [id], onDelete: Cascade)
}
```

Expira a la hora de inicio de la cita: confirmar una cita ya empezada no significa
nada. Un solo uso — `usadoEn` lo marca, en la misma transacción que cambia el estado.

### El detalle que rompe la versión ingenua

**`GET` no puede confirmar nada.** WhatsApp genera vista previa de los enlaces que
viajan en un mensaje, y los navegadores y antivirus hacen prefetch. Cualquiera de
ellos pediría la URL y confirmaría la cita sola, antes de que el cliente la vea.

Entonces:

- `GET /citas/confirmar/:token` no existe en el API. Esa ruta es del **frontend**:
  una página que canjea el token contra el API solo para *mostrar* la cita, y pinta
  un botón.
- La confirmación es `POST /citas/confirmacion` con el token en el cuerpo. Un
  prefetch no hace POST.

### Seguridad de la ruta

Es una escritura abierta a un invitado, como `POST /citas`. Aplica lo de
`03-autorizacion.md`:

- `@Public()` — quien confirma no tiene sesión, y exigirsela mata el flujo entero.
- `@UseGuards(LimiteIntentosGuard)` — un token de 32 bytes no se adivina por fuerza
  bruta, pero la ruta hace trabajo por petición y sin límite es un amplificador.
- Un token inexistente, vencido o ya usado responden **igual**. Distinguirlos
  convierte la ruta en un oráculo de qué citas existen.
- La página muestra lo mínimo: servicio, profesional, fecha. Nunca el teléfono ni el
  resto de la ficha del cliente — el enlace pudo haberse reenviado.

## Lo que falta en el esquema y no es de este módulo

Dos cosas bloquean el envío y viven en `01-modelo-datos.md`:

- **`Usuario.aceptaWhatsapp Boolean` + fecha del consentimiento.** Hoy no hay dónde
  guardarlo. Sin opt-in explícito no se manda nada: es política de WhatsApp, y es lo
  que sostiene la reputación del número. Necesita también su casilla en
  `ReservarPage`.
- **`ConfiguracionNegocio.prefijoPais`.** `normalizarTelefono` conserva el `+` solo
  si venía, y el DTO acepta siete dígitos. Un número guardado como `88887777` no se
  entrega a ningún lado. El prefijo por despliegue es lo coherente con que el
  producto sea genérico y multipaís.

Los dos se pueden hacer hoy, sin depender de WhatsApp.

## Despliegue — Contabo + Dokploy

```
VPS Contabo · Dokploy
├── api-citas            (imagen NestJS)                 :3000 → público vía HTTPS
├── worker-notificaciones(misma imagen, NOTIFICACIONES_WORKER=true)
├── mariadb              volumen persistente             red interna
└── waha                 volumen persistente de sesión   red interna
```

- **WAHA no se publica jamás.** Su API no trae autenticación fuerte por defecto:
  expuesta, cualquiera manda WhatsApp con el número del negocio. Solo red interna de
  Docker, y `WHATSAPP_API_KEY` puesta igual.
- El volumen de sesión de WAHA es lo que evita reescanear el QR en cada despliegue.
  Perderlo es perder la sesión.
- El volumen de MariaDB es la base. Ya vale lo mismo que en local: `down -v` la
  borra.
- El webhook de WAHA hacia el API viaja por la red interna. No necesita salir.

## Sobre los nombres de carpeta

La estructura propuesta usa `src/modules/`, `src/integrations/`, `src/jobs/` y
nombres en inglés. Este backend no está organizado así: los dominios cuelgan planos
de `src/` (`citas/`, `empleados/`, `servicios/`) y el vocabulario es español en todas
las capas, sin traducir entre ellas.

La misma idea, en la convención del repo:

```
src/notificaciones/
├── 09-conexion-whatsapp.md          ← este archivo
├── notificaciones.module.ts          global, como PrismaModule (ver abajo)
├── notificaciones.config.ts          NOTIFICACIONES_WORKER, lote, reintentos
├── outbox.service.ts                 encolar (lo llama CitasService)
├── notificaciones.worker.ts          el @Cron que drena
├── whatsapp.gateway.ts               el puerto: interfaz, sin implementacion
├── whatsapp-log.gateway.ts           implementacion de mentira, escribe al log
├── plantillas.ts                     el texto de cada aviso (del negocio, no del canal)
├── confirmacion.service.ts           tokens: emitir, canjear
├── confirmador-citas.port.ts         lo que este modulo necesita de citas
├── confirmacion.controller.ts        POST /citas/confirmacion
├── acuses.service.ts                 concilia entregas, idempotencia de webhooks
└── dto/confirmar-cita.dto.ts

src/citas/citas.confirmador.ts        implementa el puerto de arriba

src/integrations/waha/                el adaptador, aislado a proposito
├── waha.client.ts
├── waha.config.ts
├── waha.types.ts                     chatId y ack: vocabulario que no sale de aqui
├── waha.module.ts
└── waha-webhook.controller.ts        POST /webhooks/whatsapp
```

**Dos desvios de la estructura propuesta, y por que.**

El webhook quedo en `integrations/waha/` y no en `notificaciones/`: lo que entra por
ahi es vocabulario del canal —`ack`, `@c.us`, la firma HMAC de WAHA—, y un controlador
en `notificaciones/` que lo parsea es exactamente la frontera que este documento dice
no cruzar. Lo que sale de ahi hacia `AcusesService` ya esta traducido.

Y `CitasModule` **no** importa `NotificacionesModule`: lo alcanza porque es global,
igual que `PrismaModule`. El grafo es circular por diseño —citas encola, y el canje
del enlace vuelve a citas a cambiar el estado— y con los dos modulos importandose con
`forwardRef` el arranque se queda colgado sin ningun error, a medio inicializar. El
ciclo se toca en un solo punto: `citas/citas.confirmador.ts`, que inyecta
`CitasService` con `forwardRef`. Ese archivo existe para que `ConfirmacionService`
dependa de un puerto y no de `CitasService`, que en ESM cerraba un ciclo entre
archivos y reventaba al arrancar con `Cannot access 'ConfirmacionService' before
initialization`.

`integrations/` sí es carpeta nueva y se justifica sola: marca la frontera con lo que
está afuera y es reemplazable. `SyncModule` podría mudarse ahí después; no ahora.

## Orden de implementación

Cada paso deja algo verificable. Los tres primeros no dependen de WhatsApp y se
prueban con `curl`.

1. **Hecho · Esquema**: `NotificacionSalida`, `TokenConfirmacion`, `EventoWebhook`,
   `Usuario.aceptaWhatsapp` (con la fecha del consentimiento) y
   `ConfiguracionNegocio.prefijoPais`. Migración `20260907082726_notificaciones`. La
   semilla **rellena** `prefijoPais` cuando esta en NULL en vez de reescribir la
   identidad del negocio: una fila anterior al campo dejaria el modulo sin entregar un
   solo mensaje, y eso es un sintoma silencioso.
2. **Hecho · Outbox + tokens.** `CitasService.reservar` llama a
   `OutboxService.encolarConfirmacion(tx, citaId)` dentro de su propia transacción, y
   el outbox emite el token ahi mismo. Citas no sabe que el aviso lleva un enlace
   firmado. El enlace vive en `variables` mientras la fila esta pendiente y el worker
   lo borra al enviar, para que en reposo vuelva a quedar solo el hash del token.
3. **Hecho · Confirmación de punta a punta, sin WhatsApp.**
   `POST /citas/confirmacion` y `POST /citas/confirmacion/consulta`, la página
   `Template/src/pages/citas/ConfirmarCitaPage.tsx` en `/citas/confirmar/:token`, y
   `PENDIENTE → CONFIRMADA` con `slotOcupado` intacto. Verificado tambien lo aburrido:
   confirmar dos veces es un no-op, y un token inexistente responde igual que uno
   vencido.
4. **Hecho · Gateway y worker** contra `WhatsappLogGateway`, que escribe el mensaje al
   log en vez de mandarlo. Ahi se verifican el reclamo `FOR UPDATE SKIP LOCKED`, el
   retroceso 1/5/15/60 min, el tope a `FALLIDA` y la devolucion a la cola de un
   reclamo colgado — que es donde estan los errores dificiles.
5. **Falta escanear · WAHA.** El adaptador, su config y el webhook estan escritos, y
   el webhook verificado con firma valida, invalida y evento repetido. Lo que queda es
   manual. Ver abajo.
6. **Pendiente · Recordatorio** (`RECORDATORIO_CITA`): otro `@Cron` que encola N horas
   antes. Reusa todo lo anterior; es una fila más en el outbox.

---
# WAHA

Instalado y verificado. **La sesión existe y sigue esperando el escaneo del QR.** El
codigo del envio ya esta —`waha.client.ts` y el webhook—, asi que escanear es
literalmente lo unico que separa a este modulo de mandar mensajes de verdad.

Lo de aquí abajo es lo que hace falta para operarlo, no un tutorial de arranque: eso
lo cubre el [README del proyecto](https://github.com/devlikeapro/waha).

## Lo que ya corre

Servicio `waha` en el `docker-compose.yml` de la raíz.

| | |
|---|---|
| Imagen | `devlikeapro/waha:latest-2026.8.2` |
| Tier | CORE (gratis) |
| Motor | WEBJS — Chromium real adentro del contenedor |
| Contenedor | `citas-waha` |
| Publicado en | `127.0.0.1:3001` |
| Volumen | `waha-sessions` → `/app/.sessions` |

**Ojo con el nombre del tag.** `latest-2026.8.2` no significa "la más nueva":
`latest` es el nombre de la *variante* con Chromium incluido, y `2026.8.2` es la
versión. Las otras variantes de esa misma versión son `noweb-2026.8.2` (websocket,
sin navegador, mucho más liviana) y `gows-2026.8.2` (lo mismo en Go). Pedir
`devlikeapro/waha:2026.8.2` a secas **no existe** y el `pull` falla.

Se fija la versión por lo mismo que MariaDB: la de tu máquina y la del VPS tienen que
ser la misma, o terminas depurando diferencias que no están en tu código.

## Puertos — el choque que hay que evitar

**WAHA escucha en 3000 adentro del contenedor. El API de citas escucha en 3000 en el
host.** Es el mismo número y son dos cosas distintas.

No chocan porque el puerto se publica corrido:

```
127.0.0.1:3001  (host)  →  3000  (contenedor)
```

O sea: el API de citas sigue en `localhost:3000`, WAHA se atiende en
`localhost:3001`, y adentro del contenedor nadie más usa el 3000. Cambiar el mapeo a
`3000:3000` rompe el arranque del API con `EADDRINUSE`.

**En el VPS esa línea `ports:` se borra entera.** WAHA queda solo en la red interna de
Docker y el worker lo alcanza por nombre de servicio (`http://waha:3000`). Publicarlo
no aporta nada y abre lo que dice la sección siguiente.

## Autenticación

`WHATSAPP_API_KEY` es obligatoria y viaja en la cabecera **`X-Api-Key`** en cada
petición. Verificado: sin clave y con clave incorrecta, `401`.

Es la única autenticación que tiene. Y responde con `Access-Control-Allow-Origin: *`,
así que expuesto a internet cualquier página web puede pegarle desde el navegador de
un visitante. **Quien alcance ese puerto manda WhatsApp con el número del negocio.**
De ahí que el mapeo sea a loopback en local, y que en el VPS no se publique.

El panel (`/dashboard`) tiene credenciales aparte: `WAHA_DASHBOARD_USERNAME` y
`WAHA_DASHBOARD_PASSWORD`. Por defecto son `waha`/`waha`; están sobrescritas.

Las tres claves (`WAHA_API_KEY`, la del panel y `WAHA_HOOK_HMAC_KEY`) se generaron
aleatorias y viven en el `.env` de la **raíz**, que es un archivo distinto del de
`apiBase/`. La raíz no tenía `.gitignore` hasta ahora; se creó uno para ese archivo.

## Ciclo de vida de la sesión

```
STARTING  →  SCAN_QR_CODE  →  WORKING
```

Del orden de 15–25 s hasta `SCAN_QR_CODE`: está levantando Chromium.

```bash
KEY=$(grep WAHA_API_KEY= .env | cut -d= -f2-)

# crear y arrancar
curl -X POST http://localhost:3001/api/sessions \
  -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"name":"default","start":true}'

# en qué estado va
curl -H "X-Api-Key: $KEY" http://localhost:3001/api/sessions/default

# el QR, como PNG
curl -H "X-Api-Key: $KEY" http://localhost:3001/api/default/auth/qr --output qr.png
```

Más cómodo: **`http://localhost:3001/dashboard`** muestra el QR en pantalla.

El worker no ejecuta nada de esto. Arrancar una sesión y escanear un QR es operación
manual, una vez por despliegue; el código solo manda mensajes contra una sesión que ya
está `WORKING`.

## `chatId` y el hueco de los teléfonos

Enviar es así:

```bash
curl -X POST http://localhost:3001/api/sendText \
  -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"session":"default","chatId":"50688887777@c.us","text":"Hola"}'
```

El `chatId` es **el número internacional sin `+`, con `@c.us` pegado atrás**.

Esto conecta directo con el hueco que ya señalaba la spec: `normalizarTelefono`
conserva el `+` solo si venía, y el DTO acepta siete dígitos. Un `88887777` produce
`88887777@c.us`, que no es nadie. **`ConfiguracionNegocio.prefijoPais` no es un
adorno: sin él este módulo no entrega un solo mensaje.**

La traducción de teléfono a `chatId` vive en `waha.client.ts` y en ningún otro lado.
`@c.us` es vocabulario de WhatsApp; que se filtre al outbox o al dominio es la
frontera del gateway rompiéndose.

## Persistencia

El volumen `waha-sessions` guarda la sesión de WhatsApp Web. Borrarlo obliga a
reescanear el QR con el teléfono en la mano — que es justo lo que no se puede hacer a
distancia un domingo.

`WHATSAPP_RESTART_ALL_SESSIONS=True` hace que las sesiones vuelvan solas al reiniciar
el contenedor. Sin eso hay que arrancarlas a mano después de cada despliegue.

`docker compose down` no lo toca. `docker compose down -v` **sí lo borra**, igual que
borra la base.

## Límites del tier CORE

- **Una sola sesión.** Un número por instancia. Varios negocios en un VPS son varias
  instancias, o Plus.
- **No manda medios.** Solo texto. Para la confirmación alcanza: es un enlace.

Ninguno de los dos bloquea lo que este módulo necesita. Si algún día hacen falta, es
decisión de costo, no de código.

## Lo que falta para conectarlo

1. **Falta · Escanear el QR** con el número dedicado. Es lo unico que queda y es
   manual: `/dashboard`, o el endpoint del QR. Hasta que el estado diga `WORKING`, no
   sale nada. Es tambien el punto de no retorno: ese numero es el que se arriesga.
   Despues de escanear, descomentar `WAHA_URL=http://localhost:3001` en
   `apiBase/.env`; mientras esa variable este vacia el worker usa el gateway de log y
   todo lo demas funciona igual.
2. **Hecho · `waha.client.ts`** implementando `whatsapp.gateway.ts` con
   `POST /api/sendText`. Config propia (`WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION`) en
   su namespace, como `external-api.config.ts`. En local
   `WAHA_URL=http://localhost:3001`; en el VPS, `http://waha:3000`.
3. **Hecho · `waha-webhook.controller.ts`**, y las tres variables de webhook del
   `docker-compose.yml` ya descomentadas. La firma se calcula sobre el cuerpo crudo,
   asi que `main.ts` arranca con `rawBody: true`: recalcularla sobre el JSON
   re-serializado cambia espacios y orden de claves y ninguna firma legitima
   coincidiria.
   - `WHATSAPP_HOOK_URL` — en local
     `http://host.docker.internal:3000/webhooks/whatsapp`; el `extra_hosts` del
     compose es lo que le permite al contenedor alcanzar tu host. En el VPS, la URL
     interna del API.
   - `WHATSAPP_HOOK_EVENTS` — `message,message.ack`. Nada de `*`: cada evento
     suscrito es una petición que tu API tiene que atender y descartar.
   - `WHATSAPP_HOOK_HMAC_KEY` — ya está generada. La firma se verifica en el handler
     con comparación de tiempo constante, porque la ruta es `@Public()`.
4. **Hecho · Idempotencia del webhook.** El id del evento se guarda en
   `EventoWebhook` y el repetido se descarta. Un evento **sin** id se descarta entero:
   sin id no hay como saber si es repetido, y arriesgar un doble efecto es peor que
   perder un acuse.
5. **Hecho · Acuses de entrega.** `message.ack` trae el id del mensaje, que es lo que
   se guardó en `NotificacionSalida.idExterno`. Con eso se marca `entregadaEn`, o se
   anota que el número no tiene WhatsApp — información que el personal necesita para
   levantar el teléfono. Un `ack` de error **no** reintenta: el envio si ocurrio, lo
   que fallo es la entrega, y reintentarlo solo duplica.
6. **Pendiente · Respuesta de texto, como comodidad y nunca como único camino.** Si el cliente
   escribe "confirmar" en vez de tocar el enlace, se resuelve **solo cuando tenga
   exactamente una** cita pendiente. Con dos o más se le reenvía el enlace; adivinar
   confirma la cita equivocada. Si el texto no se reconoce, tampoco se adivina.

## El riesgo, escrito

WAHA maneja una sesión real de WhatsApp Web por ingeniería inversa. Viola los
términos de servicio de WhatsApp. **El baneo cae sobre el número del negocio, es
permanente, y se lleva por delante el canal por el que sus clientes le escriben** —
no solo estas notificaciones.

Los mensajes de confirmación son el peor perfil posible para la detección: salientes,
hacia gente que no escribió primero, y que en su mayoría no se responden. El conteo
de mensajes sin respuesta es una señal que WhatsApp usa desde 2026. Los "modos
anti-baneo" con retardos aleatorios atacan una sola capa de detección y no evitan
nada.

Se asume a sabiendas, con dos condiciones que no son negociables:

- El número es **dedicado y desechable**. Nunca el número principal del negocio. Esto
  se decide **antes** de escanear el QR: después ya está hecho.
- El día que caiga, se migra a la Cloud API oficial. Ese día no debe tocar ni el
  outbox, ni el worker, ni el dominio de citas — solo aparece un `integrations/meta/`
  al lado de `integrations/waha/`. **Si esa migración resulta cara, la frontera del
  gateway se rompió en algún punto, y eso es el defecto a arreglar, no la migración.**

## La alternativa, para cuando toque decidir

La Cloud API de Meta no necesita nada en Docker: es HTTP contra `graph.facebook.com`.
A cambio pide número no registrado en WhatsApp, Business Manager verificado, política
de privacidad publicada, plantillas aprobadas una por una, y opt-in explícito. El alta
ronda los 5–7 días hábiles.

Cobra por mensaje entregado desde julio de 2025. Un recordatorio de cita cae en
categoría *utility*, y **desde el 1 de octubre de 2026 las plantillas utility dentro
de la ventana de 24 h dejaron de ser gratis**. Los mensajes no entregados no se cobran.

Riesgo de baneo cumpliendo la política: prácticamente nulo. Es la diferencia que se
está comprando.
