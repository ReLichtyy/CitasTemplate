# 11 · Chatbot de reservas por WhatsApp

Vive junto a `chatbot.module.ts`. Da por sabidas las invariantes de `apiBase/CLAUDE.md`,
las reglas de reserva de `02-reservas-concurrencia.md` y la conexión del canal de
`09-conexion-whatsapp.md` — este módulo vive sobre esa infraestructura, no la reemplaza.

## Qué resuelve

Hoy el cliente llega a la reserva por la web. Este módulo agrega el otro camino que el
número del negocio ya tiene abierto: el cliente **escribe por WhatsApp** y el bot lo
conduce hasta la cita — servicio, profesional, día, hora, nombre, resumen, alta.

La reserva que sale de aquí es exactamente la misma que la de `POST /citas`: pasa por
`CitasService.reservar`, nace `PENDIENTE` a nombre del teléfono que escribió, y el aviso
con el enlace firmado de confirmación sale igual por el outbox. El bot es una puerta más
al mismo proceso, no un proceso paralelo.

Qué **no** resuelve: no responde preguntas generales, no consulta ni cancela citas ya
existentes, y **no confirma citas por texto** — la confirmación sigue siendo el enlace
firmado de `09-conexion-whatsapp.md`, por las tres razones que allí se escriben
(ambigüedad de destino, parseo sin fondo, dominio atado al canal). Solo el alta.

## Las decisiones que ordenan todo lo demás

### 1 · El bot no sabe que existe WAHA

La misma frontera de `09`, en los dos sentidos:

- **Lo que entra.** El webhook (`integrations/waha/waha-webhook.controller.ts`) ya
  recibe los eventos `message` — hoy los descarta. A partir de aquí los traduce: `from`
  (chatId) → teléfono en forma local, `body` → texto, y llama al puerto
  `ProcesadorMensajes`. El vocabulario del canal (`@c.us`, `fromMe`, la forma del
  chatId) no sale de `integrations/waha/`. La traducción inversa de `aChatId` —chatId a
  teléfono local— vive en `waha.types.ts`, junto a la directa.
- **Lo que sale.** El bot contesta por `WhatsappGateway`, el mismo puerto del worker.
  Se le agrega un método `enviarTexto(destino, texto)`: el canal es el mismo, el
  adaptador es el mismo, y el día de migrar a la Cloud API de Meta se implementa igual
  que `enviar`. Un segundo puerto para el mismo canal sería dos fronteras que vigilar.

Si el nombre "waha" aparece dentro de `chatbot/`, la frontera ya se rompió.

### 2 · El teléfono sale del canal, no del teclado

El chatId de quien escribe **es** el teléfono del cliente. El bot jamás lo pregunta; lo
usa como `cliente.telefono` del camino de invitado. Esto es la misma apuesta cerrada en
SPEC.md —"el teléfono no está verificado"— con un matiz a favor: aquí el cliente
escribió desde ese número, que es la verificación de posesión más fuerte que este
producto tiene.

Un chatId que no normaliza a la forma local (`normalizarTelefono` no deja 8 dígitos:
un número extranjero) no puede reservar: se contesta un mensaje genérico y no se crea
fila. No es un error a arreglar — es la misma base de datos de un solo país que ya
decidió `ConfiguracionNegocio.prefijoPais`.

### 3 · El asistente interpreta texto libre; la base solo ve datos validados

El bot tiene **dos modos**, compuestos en `chatbot.module.ts` como se compone el
gateway (`WAHA_URL` vacia → gateway de log):

- **Modo conversacional** (`chatbot-llm.service.ts`): con `LLM_API_KEY` puesta, un
  asistente LLM interpreta texto libre —"quiero una limpieza con Ana el jueves a las
  4"— y decide el paso. Sus instrucciones (`instrucciones.ts`) llevan el objetivo
  principal (que el cliente reserve) y los posibles (consultar catálogo, precios,
  horarios, cancelar la reserva en curso, redirigir cualquier otra cosa), mas las
  reglas: solo ofrecer lo del contexto, no prometer citas que no creo, "cancelar"
  siempre cancela.
- **Modo menus** (`chatbot.service.ts`): sin clave, el flujo es de opciones
  numeradas —servicio, profesional, "1. hoy · 2. manana · 3. pasado manana", slots—.
  No necesita ningun proveedor y reserva de punta a punta igual.

Lo que NO cambia entre modos, y es la raya del diseño:

- **El contexto del asistente es siempre dato del servidor.** El modelo ve el
  catalogo real y los slots reales de `disponibilidad`; no puede inventar
  disponibilidad ni precios porque no los conoce fuera del contexto.
- **Todo lo que el modelo devuelve en `datos` se valida** en este modulo: el
  servicio contra el catalogo, el profesional contra los del servicio, la hora
  contra los slots mostrados en ese turno, el nombre contra las cotas del DTO. Lo
  invalid se descarta y se registra; el proximo turno lo vuelve a pedir.
- **El alta y el comprobante son deterministicos.** El modelo puede pedir la
  reserva (`accion: "reservar"`), pero quien crea la cita es `CitasService.reservar`
  — igual que la web — y el comprobante que ve el cliente es texto del sistema, no
  del modelo. Un `accion "reservar"` sin los cuatro datos validados no se relee: el
  modelo pudo haber dicho "listo, reservada" de una cita que no existe.
- El modelo no puede confirmar citas por si mismo ni tocar la base: la confirmacion
  formal sigue siendo el enlace firmado de `09`, y el 409 de `reservar` se maneja
  igual que en el modo menus.

### 4 · La conversación es una fila, no memoria

```prisma
enum EstadoConversacion {
  ELIGIENDO_SERVICIO
  ELIGIENDO_PROFESIONAL
  ELIGIENDO_DIA
  ELIGIENDO_HORA
  PIDIENDO_NOMBRE
  CONFIRMANDO
}

model ConversacionChatbot {
  /// Telefono en forma local: la identidad del cliente ya decidida en SPEC.md.
  /// Una conversacion activa por numero.
  telefono     String              @id
  estado       EstadoConversacion
  /// Lo recogido hasta ahora: servicioId, empleadoId, inicio, nombre.
  /// Solo lo que ese estado necesita; se sobrescribe al avanzar.
  datos        Json
  /// Inactividad: pasado este instante, el proximo mensaje empieza de cero.
  expiraEn     DateTime
  creadaEn     DateTime            @default(now())
  actualizadaEn DateTime           @updatedAt
}
```

Invariantes:

1. **Una fila por teléfono.** Cada mensaje hace upsert de esa fila; no hay historia
   de chatbot fuera de ella.
2. **Expira sola.** La expiración (config, 30 min por defecto) se comprueba al llegar
   un mensaje: vencida se borra y se empieza de cero. Nadie tiene que barrer la tabla.
3. **En `datos` vive la elección en curso y, solo en el modo conversacional, el
   historial que el asistente necesita como contexto** — los últimos ~10 turnos,
   cada texto acotado. Es lo mínimo para que un "sí, esa" signifique algo al turno
   siguiente; lo que no se guarda es una transcripción aparte.

### 5 · La reserva es la misma de la web

`chatbot/reservador-citas.port.ts` declara lo que este módulo necesita de citas —
`reservar(dto)` y `disponibilidad(query)`— y `citas/citas.reservador.ts` lo implementa,
el patrón exacto de `citas.confirmador.ts`: una línea de pegamento, la lógica sigue
siendo de `CitasService` con su transacción y su invariante de `slotOcupado`.

El bot llama a `reservar` sin usuario: es el camino de invitado, con
`cliente: { telefono: <del canal>, nombre: <lo pedido> }`. Consecuencias directas:

- La transacción de reserva es la misma, con el `@@unique` y el rechazo de solapados:
  si entre el menú y el "confirmar" alguien más tomó el hueco, `reservar` responde 409
  y **el bot relee ese 409 tal cual** — es el único mensaje redactado para el usuario
  final — y vuelve a ofrecer horarios.
- El outbox de confirmación se encola dentro de esa transacción como siempre: el
  enlace firmado le llega al cliente por el worker, con o sin bot de por medio.
- Ningún otro error se retransmite: lo que no es 409 es genérico ("no pudimos guardar
  tu cita, inténtalo más tarde"), porque nada de Prisma ni de trazas sale al cliente.

### 6 · El bot contesta directo, no por el outbox

El outbox existe para que un aviso transaccional sobreviva a un canal caído. El bot es
otra cosa: contesta **dentro del manejo del webhook**, a un cliente que está esperando
la respuesta en la pantalla.

- La respuesta del bot **no** va por `NotificacionSalida`: no hay reintento de
  conversación. Si `enviarTexto` falla, se registra y no pasa nada más — el cliente no
  vio respuesta y a los segundos escribe de nuevo, que es su propio reintento.
- La regla dura se mantiene igual: **la llamada de red nunca va dentro de la
  `$transaction`**. El bot contesta después de que `reservar` devolvió.
- Los acuses de los mensajes del bot no concilian con nada (no hay fila que marcar):
  `message.ack` de un id que no existe en `NotificacionSalida` ya es un no-op en
  `AcusesService`, y así queda bien.

### 7 · Quien escribe decide las instrucciones, y lo verifica el servidor

El telefono es la credencial (decision cerrada en SPEC.md), asi que tambien decide
la personalidad del asistente. `CatalogoBotService.esAdministrador` mira si el
telefono que escribe es un `Usuario` activo con rol `ADMIN`:

- **Admin:** tuteo, colega a colega, sin cortesia comercial. Puede consultar la
  agenda de hoy —que viaja entera en el contexto, solo lectura— y reservar como
  cualquiera. Lo que no se hace por chat (editar, cancelar, catalogo) se lo dice y
  lo manda al panel web.
- **Cliente:** la personalidad de siempre, y ni la agenda ni la ficha de otros
  clientes entran a su contexto.

La verificacion es del servidor y del turno: el modelo recibe `esAdmin` ya
resuelto y no decide nada de eso. Y el alta es la misma para los dos — ser admin no
agrega acciones al chat, solo personalidad y lectura de agenda.

### El loop que hay que romper

El bot contesta por la misma sesión que escucha. El propio `enviarTexto` genera un
evento `message` con `fromMe: true` — sin filtrarlo, el bot se responde a sí mismo
hasta agotar la tarifa. **Descartar `fromMe` es obligación del webhook**, antes de
llamar al puerto, igual que descarta la sesión ajena. Es vocabulario del canal; el bot
ni se entera de que existe.

## Frontera con el resto

Lo que este módulo pide a otros, y dónde vive cada cambio:

| A quién | Qué | Dónde |
|---|---|---|
| Esquema (`01-modelo-datos.md`) | `ConversacionChatbot` + `EstadoConversacion` (con `CONVERSANDO` para el modo LLM) | `schema.prisma` + migraciones |
| Notificaciones | `WhatsappGateway.enviarTexto` abstracto, exportar el gateway | `whatsapp.gateway.ts`, `notificaciones.module.ts` |
| Citas | El puerto `ReservadorCitas` y su binding | `citas.reservador.ts`, `citas.module.ts` |
| Catálogo | Las lecturas públicas de servicios y empleados | `catalogo-bot.service.ts` reusa `ServiciosService` |
| Integraciones/waha | `from`, `body`, `fromMe` en el DTO; la traducción chatId→teléfono; el ruteo del `message` | `evento-waha.dto.ts`, `waha.types.ts`, `waha-webhook.controller.ts` |
| Integraciones/mistral | El adaptador del asistente sobre el puerto `AsistenteChat` | `mistral.client.ts`, `mistral.config.ts` |
| Configuración | `CHATBOT_ENABLED` (default `false`), `CHATBOT_EXPIRACION_MIN` (30), `LLM_API_KEY`/`LLM_MODEL`/`LLM_TIMEOUT_MS` | `chatbot.config.ts`, `integrations/mistral/mistral.config.ts`, `.env.example` |

**El interruptor importa.** Con `CHATBOT_ENABLED=false` el webhook sigue descartando
`message` exactamente como hoy: el camino de avisos no cambia ni un bit hasta que el
bot se encienda a propósito. La composición es la del gateway: el módulo ata
`ProcesadorMensajes` a `ChatbotService` cuando está encendido y a un `ProcesadorNulo`
—que registra y devuelve— cuando no.

**Sobre el riesgo de baneo** (`09`, "El riesgo, escrito"): el perfil del bot es
*mejor* que el de los avisos salientes — es conversación que el cliente inició, dentro
de la ventana de 24 h, con respuestas a lo que él preguntó. No lo vuelve inocuo: el
número sigue siendo dedicado y desechable, y esa condición sigue sin ser negociable.

## Estructura

```
src/chatbot/
├── 11-chatbot-reservas.md         ← este archivo
├── chatbot.module.ts                compone: LLM → menus → nulo, segun las variables
├── chatbot.config.ts                CHATBOT_ENABLED, CHATBOT_EXPIRACION_MIN
├── mensajes.port.ts                 ProcesadorMensajes + MensajeEntrante: lo que el webhook llama
├── asistente.port.ts                el puerto del cerebro conversacional (AsistenteChat)
├── chatbot-llm.service.ts           modo conversacional: valida lo del modelo y orquesta
├── instrucciones.ts                 el prompt: objetivos, reglas y contexto de cada turno
├── chatbot.service.ts               modo menus: mensaje → transición → respuesta(s)
├── flujo-reserva.ts                 tipos de la conversación, parseo y textos de los menús
├── conversacion.service.ts          upsert/expiración de ConversacionChatbot
├── reservador-citas.port.ts         lo que este módulo necesita de citas
└── catalogo-bot.service.ts          catálogo, días y formatos, para los dos modos

src/citas/citas.reservador.ts        implementa el puerto de citas (patrón de citas.confirmador.ts)
src/integrations/mistral/            el adaptador del asistente, aislado a propósito
├── mistral.client.ts                POST /chat/completions con response_format JSON
└── mistral.config.ts                 LLM_API_KEY, LLM_MODEL, LLM_TIMEOUT_MS
```

Cada archivo tiene un solo trabajo y el grafo no tiene ciclos: `chatbot` importa
`CitasModule` y `NotificacionesModule` (que exportan lo que el bot consume); nada
importa `ChatbotModule` salvo `WahaModule`, que es el único lugar que ve el puerto
`ProcesadorMensajes` desde afuera. El nombre "mistral" no aparece fuera de
`integrations/mistral/`, igual que "waha": cambiar de proveedor es otro adaptador.

## Orden de implementación

Los pasos 1 a 4 se prueban sin gastar la sesión de WhatsApp; el 5 es el primero que
necesita un teléfono en la mano. El 6 es el modo conversacional.

1. **Hecho · Esquema.** `ConversacionChatbot` + `EstadoConversacion` (migración
   `20260919163011_chatbot_conversacion`; `CONVERSANDO` llegó después con
   `20260919164407_chatbot_conversando`).
2. **Hecho · `enviarTexto` en el puerto.** Abstracto en `whatsapp.gateway.ts`,
   implementado en `whatsapp-log-gateway.ts` y `waha.client.ts`.
3. **Hecho · El modo menus.** `mensajes.port.ts`, `flujo-reserva.ts`,
   `conversacion.service.ts`, `catalogo-bot.service.ts`, `chatbot.service.ts`,
   `reservador-citas.port.ts` + `citas.reservador.ts`. Unit: mensaje → transición →
   respuestas; el 409 re-ofrece horarios; la vencida empieza de cero.
4. **Hecho · El webhook rutea.** `from`/`body`/`fromMe` en el DTO, traducción en
   `waha.types.ts`, `fromMe` descartado, llamada al puerto. Verificado con `curl` y
   firma HMAC válida contra la instancia local: reserva de punta a punta, fila
   borrada al terminar y aviso por el outbox.
5. **Falta el teléfono · Encender.** `CHATBOT_ENABLED=true` ya está; el QR ya está
   escaneado (la sesión de `09` es esta misma). Lo que queda es escribir al número
   del negocio desde otro teléfono y reservar de punta a punta, con el enlace firmado
   llegando detrás por el camino de siempre.
6. **Hecho · El modo conversacional.** `asistente.port.ts`, `instrucciones.ts`,
   `chatbot-llm.service.ts`, `integrations/mistral/` y la composición en
   `chatbot.module.ts`. Unit con un asistente guionizado: valida y descarta lo
   inventado, el alta sin datos no relee al modelo, el 409 suelta la hora, "cancelar"
   corta sin gastar turno, el asistente caído avisa y no avanza. Sin `LLM_API_KEY`
   el modulo cae al modo menus y nada de esto existe para afuera.
