# Template — arquitectura de componentes

Spec de como se organiza el frontend a partir de ahora. El backend/contrato de API queda fuera de este documento (se define aparte).

## Carpetas

```
src/
  components/
    layout/   # chrome de la app: Navbar, Footer, AppLayout. Uno de cada uno, no reusable entre paginas.
    ui/       # primitivas presentacionales reusables: Button, ButtonLink, Card, Modal, Thumbnail, CardDetailIcon, ServicioCard, EspecialistaCard, Spinner, EmptyState, PageHeader.
  pages/      # una carpeta por dominio, un archivo por ruta. Mirror del backend (auth/, citas/, gestion/<dominio>/, publico/, sistema/).
  routes/     # guards de routing (ProtectedRoute, RoleRoute).
  services/   # una funcion por endpoint de backend, agrupadas por dominio. Unico lugar que llama apiClient.
  lib/        # helpers puros sin JSX (formatPrice, formatDuration, formatFecha, especialista) y configuracionPlaceholder (unico lugar con valores de negocio fijos hasta que exista GET /configuracion).
  types/      # formas de dominio compartidas (catalogo.ts: Especialista, Servicio, Rating, Resena). Las cards reciben estos objetos, no props sueltas.
  context/    # estado cross-cutting (AuthContext).
  api/        # client.ts, el unico fetch wrapper.
```

## Cuando crear un componente compartido

- Se repite en 2+ paginas → `components/ui/`.
- Es parte del "esqueleto" de la app (nav, footer) → `components/layout/`.
- Es especifico de una sola pagina (ej. un formulario particular) → queda inline en el archivo de esa page, no se extrae.

No crear abstracciones para casos hipoteticos — si un patron aparece una sola vez, se queda donde esta hasta que se repita.

## Estilos

Tailwind CSS (v4, via `@tailwindcss/vite`, sin config de PostCSS). Clases utility inline en cada componente.

Los tokens de marca (colores, fuentes) viven en `src/index.css` dentro de `@theme` (`--color-accent`, `--color-text`, `--color-bg`, `--color-border`, etc.) y su variante dark en el `@media (prefers-color-scheme: dark)` correspondiente. No hardcodear hex en componentes — usar las clases generadas por esos tokens (`bg-accent`, `text-text-h`, `border-border`, ...).

Dark mode sigue `prefers-color-scheme` del SO automaticamente (Tailwind v4 default), no hay toggle manual todavia.

## Patron de pagina

**List page**: `PageHeader` (titulo + accion opcional como "Nuevo") → `Spinner` mientras carga → `EmptyState` si la lista viene vacia → si no, `Card` por fila, envuelta en `Link` al detalle.

**Detail page**: `PageHeader` (titulo + link "Volver") → `Spinner` mientras carga → `Card` con los campos.

Referencia viva: `pages/gestion/servicios/ServiciosListPage.tsx` + `ServicioDetallePage.tsx`. Copiar ese patron para `empleados`, `horarios`, `restricciones`, `adicionales`, y adaptar para `citas` (que tiene reglas de rol distintas, ver `App.tsx`).

Las 18 paginas restantes siguen siendo placeholders (`<h1>Titulo</h1>`) — ya heredan el `AppLayout` (Navbar/Footer) por estar dentro de la ruta layout en `App.tsx`, pero su contenido interno se migra al patron de arriba cuando se implemente ese dominio.

## Data fetching

Componentes/paginas nunca llaman `fetch` ni `apiClient` directo — siempre a traves de `services/<dominio>Service.ts`. Esto no cambio con este spec, se reitera porque es la regla que hace que swap de backend/contrato sea un cambio de un solo archivo por dominio.

## Alcance del template

Este frontend es generico a cualquier negocio de citas/reservas (salon, clinica, consultoria, etc.), no a un servicio en especifico. No hardcodear copy ni secciones atadas a un rubro puntual — el Home, el navbar y las paginas publicas deben funcionar igual sin importar que tipo de "servicio" se agende.

Navbar publico (siempre visible, sin gate): **Inicio** (`/`), **Equipo** (`/equipo`), **Reservar** (`/citas/reservar`). `Servicios` no tiene link propio en el nav — spec 07 muestra los servicios anidados por especialista dentro de `/equipo`, y `/servicios` (catalogo completo) sigue existiendo como ruta, solo que no colgada del nav. `Reservar` cuelga de `ProtectedRoute`, asi que a un invitado lo manda a `/auth/login` — es el comportamiento esperado, no un bug. Bajo `md` los links colapsan en un menu hamburguesa (`Navbar.tsx`).

`pages/publico/ServiciosPage.tsx` es el catalogo publico de servicios (para cualquier visitante). Es una pagina distinta de `pages/gestion/servicios/ServiciosListPage.tsx`, que es la vista de administracion (alta/edicion, solo admin/empleado). No fusionar ambas — sirven audiencias y permisos distintos aunque el dominio de datos sea el mismo.

## Flujo de Reservar (pendiente de backend)

`ReservarPage` (form -> confirmacion) tiene que validar disponibilidad real antes de confirmar una cita: cada Empleado tiene su propio calendario, y la fecha/hora elegida puede estar ya tomada para ese empleado puntual. Esa validacion es responsabilidad del backend (`CitasModule` + `HorariosModule`/`RestriccionesModule`, ver CLAUDE.md raiz) — hoy son stubs, asi que no hay endpoint real que la resuelva todavia.

No simular esta logica en el frontend (ni con mocks locales de "horarios ocupados"). Cuando el backend tenga el chequeo de solapamiento implementado, el paso de confirmacion de `ReservarPage` debe mostrar el error que devuelva la API (ej. 409 "horario ya tomado") en vez de inventar disponibilidad del lado del cliente.

## Pendiente (no cubierto en este pass)

- **Tipos de dominio reales** (`Cita`, `Empleado`, `Servicio`, etc.) — hoy los services devuelven `unknown`/`any` porque el contrato de API no esta definido. Los tipos usados en `ServiciosListPage`/`ServicioDetallePage` (`ServicioListItem`, `ServicioDetail`) son placeholders de forma, no el contrato real.
- Cambio de contrasena: `authService` no lo expone y `PerfilPage` no lo ofrece. Falta decidir que se pide para autorizarlo (ver 03-autorizacion.md).
- Sin libreria de data-fetching (react-query/swr) — todo es `useEffect` + `useState` manual. Revisar si vale la pena introducir una cuando haya mas paginas con fetching real.
