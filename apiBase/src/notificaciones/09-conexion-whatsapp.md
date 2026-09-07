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
├── notificaciones.module.ts
├── outbox.service.ts                 encolar (lo llama CitasService)
├── notificaciones.worker.ts          el @Cron que drena
├── whatsapp.gateway.ts               el puerto: interfaz, sin implementacion
├── confirmacion.service.ts           tokens: emitir, canjear
├── confirmacion.controller.ts        POST /citas/confirmacion
└── whatsapp-webhook.controller.ts    POST /webhooks/whatsapp   (pendiente)

src/integrations/waha/                el adaptador, aislado a proposito
├── waha.client.ts
├── waha.config.ts
└── waha.types.ts
```

`integrations/` sí es carpeta nueva y se justifica sola: marca la frontera con lo que
está afuera y es reemplazable. `SyncModule` podría mudarse ahí después; no ahora.

## Orden de implementación

Cada paso deja algo verificable. Los tres primeros no dependen de WhatsApp y se
prueban con `curl`.

1. **Esquema**: `NotificacionSalida`, `TokenConfirmacion`, `Usuario.aceptaWhatsapp`,
   `ConfiguracionNegocio.prefijoPais`. Migración y semilla.
2. **Outbox + tokens.** `CitasService.reservar` encola dentro de su transacción y
   emite el token. Sin worker todavía: se verifica leyendo la tabla.
3. **Confirmación de punta a punta, sin WhatsApp.** `POST /citas/confirmacion`, la
   página del front, `PENDIENTE → CONFIRMADA`. Se prueba pegando el token a mano.
   **Al terminar este paso el mecanismo completo ya funciona**; lo único que falta es
   que el enlace llegue solo.
4. **Gateway y worker**, contra una implementación de mentira que escribe a log en
   vez de enviar. Aquí se verifican reintentos, `SKIP LOCKED` e idempotencia — que es
   donde están los errores difíciles, y no hace falta WhatsApp para encontrarlos.
5. **WAHA.** Ver abajo.
6. **Recordatorio** (`RECORDATORIO_CITA`): otro `@Cron` que encola N horas antes.
   Reusa todo lo anterior; es una fila más en el outbox.

---

# Pendiente · WAHA

**Esta sección no se implementa todavía.** Queda escrita para que la decisión y sus
consecuencias estén registradas, no para trabajarse ahora.

El paso 4 deja el sistema entero funcionando contra un gateway falso. Conectar WAHA
es reemplazar esa implementación por otra, y nada más. Se hace cuando haya VPS y un
número dedicado que se pueda perder.

## Lo que hay que resolver cuando se retome

**Sesión y QR.** WAHA necesita escanear un QR una vez, desde su panel. En un VPS eso
significa exponer temporalmente su puerto o entrar por túnel SSH. La sesión vive en
el volumen; si se pierde, hay que volver a escanear con el teléfono en la mano.

**WAHA Core es de sesión única y no manda medios.** Para texto alcanza. Si algún día
hacen falta imágenes o varios números, es la edición Plus — decisión de costo, no de
código.

**Autenticación del webhook.** `POST /webhooks/whatsapp` es `@Public()` por
definición: lo llama un servicio, no una persona con token. Necesita entonces un
secreto compartido verificado en el propio handler, y comparado en tiempo constante.
Sin eso, cualquiera que alcance la ruta inyecta eventos.

**Idempotencia del webhook.** WAHA puede entregar el mismo evento dos veces. Se
guarda el id del evento y se descarta el repetido. Un evento procesado dos veces no
puede confirmar dos veces.

**Respuesta de texto como comodidad, nunca como único camino.** Si el cliente escribe
"confirmar" en vez de tocar el enlace, se puede intentar resolverlo — pero solo
cuando tenga **exactamente una** cita pendiente. Con dos o más, la respuesta correcta
es reenviarle el enlace, no adivinar. Y si el texto no se reconoce, tampoco se
adivina: el enlace ya está en el mensaje anterior.

**Acuses de entrega.** El evento de estado trae el id del mensaje, que es lo que se
guardó en `NotificacionSalida.idExterno`. Con eso se marca entregado o se detecta que
el número no tiene WhatsApp, que es información que el personal necesita.

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

- El número es **dedicado y desechable**. Nunca el número principal del negocio.
- El día que caiga, se migra a la Cloud API oficial. Ese día no debe tocar ni el
  outbox, ni el worker, ni el dominio de citas — solo aparece un
  `integrations/meta/` al lado de `integrations/waha/`. **Si esa migración resulta
  cara, la frontera del gateway se rompió en algún punto y eso es el defecto a
  arreglar, no la migración.**

## La alternativa, para cuando toque decidir

La Cloud API de Meta no necesita nada en Docker: es HTTP contra `graph.facebook.com`.
A cambio pide número no registrado en WhatsApp, Business Manager verificado, política
de privacidad publicada, plantillas aprobadas una por una, y opt-in explícito. El
alta ronda los 5–7 días hábiles.

Cobra por mensaje entregado desde julio de 2025. Un recordatorio de cita cae en
categoría *utility*, y **desde el 1 de octubre de 2026 las plantillas utility dentro
de la ventana de 24 h dejaron de ser gratis**. Los mensajes no entregados no se
cobran.

Riesgo de baneo cumpliendo la política: prácticamente nulo. Es la diferencia que se
está comprando.
