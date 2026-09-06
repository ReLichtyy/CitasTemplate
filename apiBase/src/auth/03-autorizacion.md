# 03 · Autorización

## Lo que ya está bien y no se toca

`JwtAuthGuard` y `RolesGuard` están registrados como `APP_GUARD` en `AppModule`: toda ruta
exige token salvo `@Public()`, y acepta cualquier rol salvo `@Roles(...)`. Deny-by-default.
Es la pieza que impide repetir el fallo del sistema anterior, donde los permisos vivían solo
en el frontend. No se debilita por conveniencia.

## Lo que falta: propiedad

Rol y propiedad son cosas distintas. `@Roles(ADMIN, EMPLEADO)` responde "¿de qué tipo es
este usuario?"; no responde "¿es suya esta cita?". Hoy no hay nada que responda lo segundo,
y dejarlo dentro de cada servicio es exactamente cómo se filtró la agenda ajena antes.

Se agrega **un guard de propiedad reutilizable**, hermano de `RolesGuard`:

- Roles con paso libre (`ADMIN`, y `EMPLEADO` sobre sus propias citas) se declaran en el decorador.
- Para el resto, carga la `Cita` del parámetro de ruta y compara `clienteId` contra el
  usuario del token. No coincide → 403, con el mismo mensaje que un 404 no daría pistas de
  si el id existe.
- `GET /citas` no lleva id: ahí el filtrado por propiedad se aplica en la consulta —
  `ADMIN` ve todo, `EMPLEADO` ve las suyas como empleado, `CLIENTE` las suyas como cliente.

La regla es: **ninguna ruta de citas queda sin declarar rol y propiedad**, igual que hoy
ninguna queda sin declarar autenticación.

## Matriz

| Alcance | Regla |
|---|---|
| Login, registro, `/health` | `@Public()` |
| Catálogo público: `/servicios`, `/servicios/:id`, `/empleados`, `/configuracion` | `@Public()`, solo registros `activo` y solo campos públicos |
| Listado completo de citas y agenda diaria | `ADMIN`, `EMPLEADO` |
| Detalle y cancelación de una cita | Los tres roles, solo la propia |
| Edición y cambio de estado | `ADMIN`, `EMPLEADO`, solo la propia |
| Crear cita | **Con o sin sesión.** Con token el cliente sale del token, y un `CLIENTE` solo reserva para sí mismo; sin token hay que mandar `cliente` con teléfono y nombre |
| Lectura de catálogos internos | `ADMIN`, `EMPLEADO` |
| Mantenimiento de servicios, adicionales, empleados, horarios, restricciones | `ADMIN` |
| Configuración del negocio y usuarios | `ADMIN` |

Pendiente de cerrar contra el código: `GET /servicios` y `GET /empleados` son hoy
`@Roles(ADMIN, EMPLEADO)`, pero `ServiciosPage` y `EquipoPage` son públicas y necesitan ese
catálogo. Se resuelve con rutas públicas de solo lectura que devuelvan **únicamente** los
registros activos y sin campos internos — no abriendo las de gestión.

## Reserva sin sesión

Reservar es la única escritura abierta a un invitado, y es deliberado: es el CTA central del
producto y exigir cuenta antes de agendar pierde justamente a quien viene a agendar.

`POST /citas` se declara `@AuthOpcional()`, **no** `@Public()`. La diferencia importa:
`@Public()` corta el guard de raíz, así que un cliente con sesión se atendería como invitado
y la cita se colgaría del usuario equivocado. Con auth opcional, si viene un token válido el
usuario queda en `@CurrentUser()`, y si no viene, la petición sigue como invitado.

Sin token, el cuerpo trae `cliente` con teléfono y nombre. El teléfono es la identidad
(decisión cerrada en `SPEC.md`), así que el servicio busca por teléfono normalizado: si ya
existe una ficha, la cita cuelga de ella; si no, se crea una **sin contraseña** —
`Usuario.password` es opcional por esto, y el login rechaza a quien no la tiene.

Dos consecuencias que se asumen con los ojos abiertos:

- Una ficha existente **no se reescribe** con los datos que mande el invitado. Nadie le
  cambia el nombre ni el correo a un cliente registrado escribiendo su número.
- **Reservar a nombre de un teléfono ajeno es posible.** Sin verificación del número no hay
  forma de impedirlo. Lo que sí se impide es que la respuesta lo revele: al invitado se le
  devuelve un comprobante sin `cliente` ni `registradaPor`, porque devolver la ficha
  convertiría la reserva en una consulta de datos ajenos. Si algún día se agrega
  verificación por SMS, es aquí donde entra.

`/citas` y el resto de las rutas de citas **no** se abren: un invitado no tiene citas que
ver. El frontend lo manda a la página de sin acceso, no al login, porque entrar no le
resolvería nada.

## Identidad y credenciales

Login por **teléfono**, decisión cerrada en `README.md`. Cambian, y deben cambiar juntos:

- `LoginDto` — `@IsEmail() email` pasa a un teléfono validado como string con formato.
- `JwtPayload` y `AuthenticatedUser` — `email` pasa a `telefono`.
- `Template/src/services/authService.ts` — `LoginPayload`.
- `LoginPage` — el campo y su etiqueta.

`AuthService.login` busca por teléfono, compara con **bcrypt** (falta la dependencia) y
rechaza usuario inactivo. Un teléfono inexistente y una contraseña incorrecta devuelven el
mismo error: no se confirma si un número está registrado.

El token lleva `sub`, `telefono` y `rol`. Nada más — en particular, nada que el servidor
vaya a volver a consultar de todos modos.

## Secretos

`JWT_SECRET` tiene hoy fallback a `'dev-secret-change-me'` en `auth.module.ts` y en
`jwt.strategy.ts`, y ese valor está en `.env.example`. Si la variable falta en producción, el
API firma con un secreto que está publicado en el repositorio y cualquiera se fabrica un
token de administrador.

**El fallback se elimina.** Sin `JWT_SECRET` el proceso falla al arrancar. Vale lo mismo
para `DATABASE_URL`. Una caída al iniciar es un incidente de cinco minutos; un secreto por
defecto es una brecha silenciosa.

`/docs` se monta con `app.use()` en `main.ts`, que es middleware de Express crudo y no pasa
por los guards de Nest: la referencia completa del API queda pública. Se restringe a
entorno de desarrollo.

## Frontend

`api/client.ts` ya adjunta el token. Falta la otra mitad: un **401 debe cerrar sesión** y
redirigir al login, en vez de propagarse como error genérico.

`RoleRoute` lee el rol de `localStorage`, que el usuario puede editar. Está bien: es
cosmético, decide qué enlaces se ven. La autorización real es la del servidor, y ningún
cambio de frontend puede aflojarla.

## Colisión de valores de rol · corregir antes de tocar el login

El cliente de Prisma genera para `Rol` los valores `'ADMIN' | 'EMPLEADO' | 'CLIENTE'`. El
enum de TypeScript que `RolesGuard` compara vale otra cosa:

```ts
export enum Role { ADMIN = 'admin', ... }   // common/enums/role.enum.ts
```

Cuando `AuthService` lea `usuario.rol` de la base y lo ponga en el token, el guard va a
comparar `'ADMIN'` contra `'admin'`. No coincide: **toda ruta con `@Roles(...)` responde 403**,
incluida la administración completa. Con los servicios en stub el choque todavía no ocurre;
aparece en el primer login real, y se diagnostica mal porque parece un problema de permisos
y no de mayúsculas.

Se unifica en mayúsculas, tomando el esquema como fuente:

- `common/enums/role.enum.ts` → `ADMIN = 'ADMIN'`, `EMPLEADO = 'EMPLEADO'`, `CLIENTE = 'CLIENTE'`.
- `Template/src/services/authService.ts` → `type Role = 'ADMIN' | 'EMPLEADO' | 'CLIENTE'`.
- `App.tsx` → `allow={['ADMIN', 'EMPLEADO']}`.
- El rol guardado en `localStorage` de sesiones viejas queda inválido; el manejo de 401 de
  el manejo de 401 lo resuelve cerrando sesión.

En el mismo paso se renombra la propiedad `role` a `rol` en `JwtPayload` y
`AuthenticatedUser`: los nombres no se traducen entre capas. `sub`
se queda como está, que es la claim estándar de JWT.
