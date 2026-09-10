# apiBase — invariantes

Se cargan solas al trabajar en este workspace. Son las reglas que aplican a **todo** el
backend; los specs de cada módulo (`prisma/01-…`, `src/citas/02-…`, `src/auth/03-…`,
`src/common/04-…`, `src/common/observabilidad/10-…`) solo cubren lo propio de ese módulo y
dan estas por sabidas.

## Forma de una petición

- Cadena fija: `routes → guards → controller → service`. Cada capa llama hacia abajo, nunca
  hacia arriba ni salteándose una.
- El controlador no tiene reglas de negocio ni toca la base. El servicio no conoce
  `Request`, `Response` ni códigos HTTP.
- ESM: todo import relativo lleva `.js` aunque el archivo sea `.ts`.

## Respuestas y errores

- Sobre único: `{ success, data, message }`. Lo arma un interceptor (éxito) o el filtro de
  excepciones (error). Ningún controlador arma su propio formato.
- Los errores se **lanzan**, no se devuelven. Un servicio nunca retorna un objeto de error.
- 409 es el único mensaje redactado para que lo lea el usuario final. El resto, genéricos.
- Nunca salen al cliente: trazas, mensajes de Prisma, nombres de columna, `Usuario.password`.

## Logs

- Todo lo que se registra sale por `Logger` de Nest, y de ahí al logger estructurado
  (`common/observabilidad/`). Ningún `console.log` en `src/`.
- Toda petición deja rastro: una línea de acceso siempre, y una de excepción si falló. Las
  dos llevan el `x-request-id` que también se le devolvió al cliente — ese id es lo único
  que une el log del servidor con lo que el usuario vio.
- Los 4xx se registran (`warn`). No son fallas del servidor, pero son la mayoría de lo que
  el frontend provoca y sin ellos no hay forma de explicar un "no me deja".
- Los campos van como **objeto**, no interpolados en la cadena: `logger.log({ evento, ms })`.
  Es lo que se puede filtrar después, y lo que escapa el contenido que viene de fuera.
- Nada de lo que se registra puede llevar credenciales, tokens (ni el de confirmación de
  cita, que viaja en un query string) ni `Usuario.password`.
- Ver `src/common/observabilidad/10-observabilidad.md`.

## Autorización

- Deny-by-default: `JwtAuthGuard` + `RolesGuard` son `APP_GUARD`. Toda ruta nueva declara
  `@Public()` o `@Roles(...)` de forma explícita — nunca se confía en el default.
- Rol y propiedad son cosas distintas. Las rutas de citas declaran las dos.
- Rutas públicas de catálogo: solo registros `activo` y solo campos públicos. La respuesta
  de empleados no incluye el `Usuario` completo — el teléfono es la credencial de acceso.
- Valores de rol en **mayúsculas** (`ADMIN`, `EMPLEADO`, `CLIENTE`), y la propiedad se llama
  `rol`, igual que en el esquema. No se traducen nombres entre capas.

## Datos y dinero

- El servidor recalcula importes. Ningún precio que llegue en el cuerpo se persiste.
- `Cita.slotOcupado` es espejo de `inicio` mientras el estado bloquee disponibilidad, y
  `NULL` cuando no. Todo cambio de estado lo mantiene, en la misma transacción.
- Verificar e insertar una cita van dentro de una `$transaction`.
- Dentro de una `$transaction` no se lee configuración. `ConfiguracionNegocio` y
  `EstadoCita` son catálogo, no datos de la carrera: los sirve `CatalogoService`
  (`src/catalogo/`, global) desde su caché, leyendo por `PrismaService` y nunca por el
  `tx` del llamador. Cada consulta de más ahí es tiempo de lock, y por tanto tasa de
  conflicto entre dos personas que pulsan el mismo horario.
- Toda ruta que liste devuelve una página acotada, no la tabla. Ver `04-contrato-api.md`.
- Ninguna llamada de red va dentro de una `$transaction`. Lo que entra es la intencion
  —una fila en `NotificacionSalida`—; el envio lo hace el worker despues y reintenta.
  Un aviso que falla no puede reventar una reserva valida.
- Las horas del día son minutos desde medianoche; los instantes absolutos son `DateTime`.

## Rutas abiertas

- Toda ruta `@Public()` que escriba o que cueste trabajo (bcrypt) lleva
  `@UseGuards(LimiteIntentosGuard)` + `@LimiteIntentos(...)`. Sin eso, probar contraseñas
  cuesta lo mismo que pedirlas.
- Un fallo de credenciales responde igual para teléfono inexistente, contraseña incorrecta,
  ficha sin contraseña y cuenta inactiva — y tarda lo mismo (hash señuelo). El login no es
  un directorio de quién está registrado.
- Ningún DTO acepta `rol`, `activo` ni `telefono` en una edición de perfil. El servicio
  además los fija: la defensa no depende de la configuración del `ValidationPipe`.
- Lo que llegue de un cliente sin autenticar y termine en el log lleva enum cerrado donde
  se agrupa y tope de largo en cada campo de texto (`telemetria/`). Un campo libre sin tope
  es el disco del VPS.

## Secretos

`JWT_SECRET` y `DATABASE_URL` no tienen valor por defecto: si faltan, el proceso falla al
arrancar. Un secreto por defecto es una brecha silenciosa. `JWT_SECRET` además exige 32
caracteres (`auth/jwt-secret.ts`).

`/docs` solo se monta fuera de producción: es middleware de Express crudo y no pasa por los
guards, así que publicarlo publica la referencia completa del API.
