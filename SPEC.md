# Spec

Specs cortos, uno por componente. Cada archivo se lee solo cuando se toca ese componente.

| # | Spec | Vive junto a |
|---|---|---|
| 01 | `apiBase/prisma/01-modelo-datos.md` | `schema.prisma` |
| 02 | `apiBase/src/citas/02-reservas-concurrencia.md` | `citas.service.ts` |
| 03 | `apiBase/src/auth/03-autorizacion.md` | `auth.service.ts`, guards de `common/` |
| 04 | `apiBase/src/common/04-contrato-api.md` | interceptor y filtro de errores |
| 05 | `Template/src/05-marca-y-responsive.md` | `index.css` y sus tokens |
| 06 | `Template/src/pages/publico/06-hero-landing.md` | `LandingPage.tsx` |
| 07 | `Template/src/components/ui/07-card-servicio.md` | `ServicioCard.tsx` |
| 08 | `Template/src/pages/publico/08-pagina-especialistas.md` | `EquipoPage.tsx` |
| 09 | `apiBase/src/notificaciones/09-conexion-whatsapp.md` | `notificaciones.module.ts` |

Cada spec vive en la carpeta del código que describe: abrir el módulo es encontrarlo. Este
archivo es el único índice, y lo que un agente debe leer primero.

Complementan, no reemplazan: `CLAUDE.md` (raíz) y `Template/ARCHITECTURE.md`.

## Decisiones cerradas

**Producto genérico, sin rubro.** Ninguna entidad, copy ni componente nombra un tipo de
negocio. El rubro se expresa como datos. Ver `05-marca-y-responsive.md`.

**Un despliegue por negocio.** Una base de datos por negocio. Ninguna tabla lleva
`negocioId`. La identidad del negocio vive en `ConfiguracionNegocio`, tabla de una sola fila.
Si algún día se necesita SaaS multi-negocio, es una reescritura del esquema, no una
extensión — decidido con eso sabido.

**Identidad del cliente: teléfono.** `Usuario.telefono` es único y obligatorio; el email es
opcional. El login es por teléfono, no por email. Consecuencia asumida: el teléfono es
más volátil que el email como credencial (cambio de número = soporte manual) y no está
verificado. Ver `03-autorizacion.md`.

**MariaDB / MySQL vía Prisma.** Heredado del sistema anterior. Su consecuencia obligatoria:
sin índices parciales ni restricciones de exclusión, la concurrencia se resuelve en la capa
de aplicación. Ver `02-reservas-concurrencia.md`.

**Se reserva sin sesión.** Reservar es la única escritura abierta a un invitado: pide
teléfono y nombre, y la cita cuelga de la ficha de ese teléfono o crea una nueva sin
contraseña. Exigir cuenta antes de agendar pierde justamente a quien viene a agendar.
Consecuencia asumida y no mitigada: mientras el número no se verifique, se puede reservar a
nombre de un teléfono ajeno. El resto de `/citas` sigue cerrado, y un invitado que lo abra
va a la página de sin acceso. Ver `03-autorizacion.md`.

**Cliente-servidor: el navegador nunca es la autoridad.** React resuelve presentación y
adaptabilidad. Toda regla que importe —precio, disponibilidad, propiedad, permisos— se
decide y se aplica en el servidor. El frontend muestra lo que el API responde; no lo simula.

**Notificar no puede tumbar una reserva.** El aviso por WhatsApp sale de una tabla de
salida (outbox) que se escribe dentro de la transacción de la cita; el envío ocurre
después, en otro proceso. Ninguna llamada de red vive dentro de una `$transaction`. Y la
confirmación del cliente viaja por un enlace firmado, no por interpretar el texto de una
respuesta. Ver `09-conexion-whatsapp.md`.

**El canal de WhatsApp es reemplazable por contrato.** WAHA maneja una sesión de WhatsApp
Web por ingeniería inversa: viola los términos de servicio y el baneo cae sobre el número
del negocio, no sobre el servidor. Se asume a sabiendas, con número dedicado y desechable,
y detrás de una interfaz que la Cloud API oficial pueda implementar sin tocar el dominio.

## Orden de implementación

1. Esquema y migración inicial + semilla de catálogos (`01-modelo-datos.md`).
   **Hecho:** MariaDB local en `docker-compose.yml` (raíz, `mariadb:11.4`, solo
   `127.0.0.1`), driver adapter `@prisma/adapter-mariadb` cableado en `PrismaService`, y
   migración inicial aplicada en `apiBase/prisma/migrations/`. El API arranca contra la
   base real.
   Semilla en `apiBase/prisma/seed.ts` (`npm run db:seed`, idempotente, con ids UUID
   fijos porque los DTOs de citas validan `@IsUUID`): estados, horario de atención,
   `ConfiguracionNegocio` y un catálogo de ejemplo. Reservar funciona de punta a punta.
   **Hecho también:** `DATOS_QUEMADOS` y `apiBase/src/demo/` borrados — el interruptor
   era una segunda fuente de verdad que un `.env` olvidado podía dejar encendida.
2. Login real por teléfono con bcrypt, y `JWT_SECRET` sin fallback (`03-autorizacion.md`).
   **Hecho:** `POST /auth/login`, `POST /auth/registro`, `GET /auth/me` y `PATCH /auth/me`
   contra la base real, con `bcryptjs` (coste 12), rol en mayúsculas en todas las capas,
   límite de intentos por IP en las dos rutas abiertas, y `JWT_SECRET` obligatorio con piso
   de 32 caracteres. Pantallas de sesión, registro y perfil ya conectadas.
3. Sobre de respuesta y filtro de errores (`04-contrato-api.md`) — antes de las pantallas, porque define
   qué puede mostrar el frontend.
   **Hecho:** `SobreInterceptor` y `ExcepcionesFilter` globales. Lo que no es
   `HttpException` sale como 500 genérico y su detalle solo va al log.
4. Guard de propiedad (`03-autorizacion.md`).
5. Reserva con transacción, y el resto de `CitasService` (`02-reservas-concurrencia.md`).
6. Configuración de negocio, paleta nueva y pasada responsive (`05-marca-y-responsive.md`).
7. `ButtonLink` y hero (`06-hero-landing.md`). El destino de retorno de `ProtectedRoute` ya
   no bloquea el hero —reservar no pide sesión— y se cierra con el login del paso 2.
8. Endpoints públicos de catálogo, `ServicioCard` y `EspecialistaCard`, las páginas de
   detalle público `/servicios/:id` y `/equipo/:id`, y la página de Especialistas
   (`07-card-servicio.md`, `08-pagina-especialistas.md`).

9. Confirmación por WhatsApp (`09-conexion-whatsapp.md`). Los pasos 1 a 4 de esa spec no
   dependen de WhatsApp y se verifican con `curl`: al terminar el 3, confirmar una cita ya
   funciona de punta a punta pegando el token a mano. Conectar WAHA es el paso 5 y queda
   pendiente hasta que haya VPS y un número dedicado.
