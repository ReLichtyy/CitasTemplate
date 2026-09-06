# Spec

Specs cortos, uno por componente. Cada archivo se lee solo cuando se toca ese componente.

| # | Archivo | Cubre |
|---|---|---|
| 01 | `01-modelo-datos.md` | Entidades e invariantes. Fuente de verdad: `apiBase/prisma/schema.prisma` |
| 02 | `02-reservas-concurrencia.md` | Disponibilidad, traslape, carrera de reserva, importes |
| 03 | `03-autorizacion.md` | Roles, propiedad, identidad, secretos |
| 04 | `04-contrato-api.md` | Sobre de respuesta y errores |
| 05 | `05-marca-y-responsive.md` | Qué hace al producto genérico, paleta y reglas de adaptabilidad |
| 06 | `06-hero-landing.md` | Hero de la landing: logo y los dos botones |
| 07 | `07-card-servicio.md` | Card de servicio: contenido, rejilla y formato de precio |
| 08 | `08-pagina-especialistas.md` | Página `/equipo`: secciones, card de especialista y detalles |

Complementan, no reemplazan: `CLAUDE.md` (raíz) y `Template/ARCHITECTURE.md`.

## Decisiones cerradas

**Producto genérico, sin rubro.** Ninguna entidad, copy ni componente nombra un tipo de
negocio. El rubro se expresa como datos. Ver `05`.

**Un despliegue por negocio.** Una base de datos por negocio. Ninguna tabla lleva
`negocioId`. La identidad del negocio vive en `ConfiguracionNegocio`, tabla de una sola fila.
Si algún día se necesita SaaS multi-negocio, es una reescritura del esquema, no una
extensión — decidido con eso sabido.

**Identidad del cliente: teléfono.** `Usuario.telefono` es único y obligatorio; el email es
opcional. El login es por teléfono, no por email. Consecuencia asumida: el teléfono es
más volátil que el email como credencial (cambio de número = soporte manual) y no está
verificado. Ver `03`.

**MariaDB / MySQL vía Prisma.** Heredado del sistema anterior. Su consecuencia obligatoria:
sin índices parciales ni restricciones de exclusión, la concurrencia se resuelve en la capa
de aplicación. Ver `02`.

**Cliente-servidor: el navegador nunca es la autoridad.** React resuelve presentación y
adaptabilidad. Toda regla que importe —precio, disponibilidad, propiedad, permisos— se
decide y se aplica en el servidor. El frontend muestra lo que el API responde; no lo simula.

## Orden de implementación

1. Esquema y migración inicial + semilla de catálogos (`01`).
2. Login real por teléfono con bcrypt, y `JWT_SECRET` sin fallback (`03`).
3. Sobre de respuesta y filtro de errores (`04`) — antes de las pantallas, porque define
   qué puede mostrar el frontend.
4. Guard de propiedad (`03`).
5. Reserva con transacción, y el resto de `CitasService` (`02`).
6. Configuración de negocio, paleta nueva y pasada responsive (`05`).
7. `ButtonLink`, `ProtectedRoute` con destino de retorno, y hero (`06`).
8. Endpoints públicos de catálogo, `ServicioCard` y `EspecialistaCard`, las páginas de
   detalle público `/servicios/:id` y `/equipo/:id`, y la página de Especialistas
   (`07`, `08`).
