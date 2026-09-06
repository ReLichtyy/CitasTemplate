# apiBase — invariantes

Se cargan solas al trabajar en este workspace. Son las reglas que aplican a **todo** el
backend; los specs de cada módulo (`prisma/01-…`, `src/citas/02-…`, `src/auth/03-…`,
`src/common/04-…`) solo cubren lo propio de ese módulo y dan estas por sabidas.

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
- Las horas del día son minutos desde medianoche; los instantes absolutos son `DateTime`.

## Secretos

`JWT_SECRET` y `DATABASE_URL` no tienen valor por defecto: si faltan, el proceso falla al
arrancar. Un secreto por defecto es una brecha silenciosa.
