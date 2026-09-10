# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Generic appointment-booking (citas) base project — not tied to any specific business vertical (salon, clinic, consulting, etc.). Two independent npm workspaces, not yet linked by any tooling (no monorepo config, no root `package.json`):

- `apiBase/` — NestJS backend. Owns the REST API and sync with an external API (contract not yet defined).
- `Template/` — React + Vite frontend. Owns the public-facing app (home page first).

Each directory is built, linted, and tested independently — always `cd` into the relevant one before running commands.

## Commands

### apiBase (NestJS)

```bash
cd apiBase
npm run start:dev      # watch mode, http://localhost:3000
npm run build           # nest build (tsc)
npm run lint            # oxlint src/
npm run test             # vitest run (unit)
npm run test:watch
npm run test:cov
```

Run a single test file: `npx vitest run src/path/to/file.spec.ts`.

There is no e2e/integration suite: the harness and its one scaffolded spec were removed
once it became clear the spec only asserted the deleted `GET /` placeholder. Bring back
`vitest.config.e2e.ts` together with the first real integration test, not before.

### Template (React + Vite)

```bash
cd Template
npm run dev        # http://localhost:5173
npm run build       # tsc -b && vite build
npm run lint         # oxlint
npm run preview
```

No test runner is configured yet in Template.

## Architecture

### apiBase

- **ESM throughout.** `package.json` has `"type": "module"`; every relative import in `src/` must include the `.js` extension (e.g. `import { AppService } from './app.service.js'`) even though the source file is `.ts`. This is required by NestJS's ESM/vitest setup here — don't drop the extension when adding new files.
- **`AppModule`** (`src/app.module.ts`) wires global config (`ConfigModule.forRoot({ isGlobal: true })`), `ScheduleModule.forRoot()` for cron support, `AuthModule`, `SyncModule`, and one module per domain (`CitasModule`, `EmpleadosModule`, `ServiciosModule`, `HorariosModule`, `RestriccionesModule`, `AdicionalesModule`).
- **Auth/roles are global and deny-by-default.** `AppModule` registers `JwtAuthGuard` and `RolesGuard` as `APP_GUARD`s, so every route requires a valid JWT unless the handler/controller is decorated `@Public()` (`src/common/decorators/public.decorator.ts`), and is open to any authenticated role unless decorated `@Roles(Role.ADMIN, ...)` (`src/common/decorators/roles.decorator.ts`, roles in `src/common/enums/role.enum.ts`). `@CurrentUser()` (`src/common/decorators/current-user.decorator.ts`) injects the decoded JWT payload into a handler. This exists specifically so no domain route can ever be accidentally left unauthenticated — always add `@Roles(...)` or `@Public()` explicitly on new controllers instead of relying on defaults you haven't checked.
- **`AuthModule`** (`src/auth/`) is implemented against the real database: `POST /auth/login` and `POST /auth/registro` (both `@Public()`, both rate-limited per IP with `LimiteIntentosGuard`), plus `GET /auth/me` and `PATCH /auth/me` for the signed-in user's own record, and `POST /auth/password` to rotate the password (requires the current one, returns 204, rate-limited even though it is not `@Public()`). Credential is the **phone**, hashed with `bcryptjs` at cost 12; a login failure returns the same message for unknown phone, wrong password, guest record without password, and inactive account. `JWT_SECRET` has no fallback and must be at least 32 chars (`auth/jwt-secret.ts`) — the process refuses to boot otherwise. Registering over a guest record (created by a guest booking, no password) claims it and keeps its citas; that is the documented, unverified-phone tradeoff in `03-autorizacion.md`.
- **Domain modules** (`src/citas/`, `src/empleados/`, `src/servicios/`, `src/productos/`, `src/horarios/`, `src/restricciones/`, `src/adicionales/`) all follow the same controller → service shape. `CitasService` is fully implemented; `ServiciosService` and `EmpleadosService` implement their public reads only; `horarios`, `restricciones` and `adicionales` are still stubs (`findAll` returns `[]`, everything else throws `NotImplementedException`). `citas` is the odd one out: `POST /citas` is `@AuthOpcional()` so a guest can book (see `03-autorizacion.md`), the other `/citas*` routes need a token and declare ownership with `@PropiedadCita()`, and `PATCH` is `Roles(ADMIN, EMPLEADO)` on top of that. Catalog reads (`GET /servicios`, `GET /empleados`) are `@Public()` and return only active records with public fields; their writes stay `Roles(ADMIN)`.
- **Booking conflict detection is a required part of `CitasModule`, not later polish.** Each `Empleado` has their own calendar — creating/confirming a cita must check the target date/time against that specific employee's existing citas (via `HorariosModule`/`RestriccionesModule`) and reject it as already-taken if it overlaps. A plain check-then-insert is **not** sufficient and is a known defect inherited from the previous system: the check and the insert go inside one `prisma.$transaction`, backed by the `@@unique([empleadoId, slotOcupado])` constraint on `Cita`. Full rules — including the `slotOcupado` invariant every state change must maintain — are in `apiBase/src/citas/02-reservas-concurrencia.md`. The frontend `ReservarPage` confirm step must surface whatever the API returns, not simulate availability locally.
- **`NotificacionesModule`** (`src/notificaciones/`) es el outbox de avisos y la
  confirmación por enlace firmado, y es **global** (como `PrismaModule`): `CitasModule`
  no lo importa. `CitasService.reservar` solo llama a
  `OutboxService.encolarConfirmacion(tx, citaId)` dentro de la transacción que ya
  tenía — la llamada HTTP al canal nunca entra en una `$transaction`. El worker
  (`NOTIFICACIONES_WORKER=true`, mismo binario que el API) drena la tabla con
  `FOR UPDATE SKIP LOCKED` y retroceso 1/5/15/60 min. `POST /citas/confirmacion` es
  `@Public()`: la confirmación es POST porque WhatsApp previsualiza los enlaces y un
  GET confirmaría la cita solo. El envío es un puerto (`whatsapp.gateway.ts`); el
  adaptador vive en `src/integrations/waha/` y **el nombre "waha" no aparece fuera de
  esa carpeta**, salvo el `useFactory` de `notificaciones.module.ts`, que es la raíz de
  composición. Sin `WAHA_URL` se usa un gateway que escribe al log y todo lo demás
  funciona igual. Detalles y estado: `apiBase/src/notificaciones/09-conexion-whatsapp.md`.
- **`CatalogoService`** (`src/catalogo/`) is `@Global()` like `PrismaModule`, and is the only
  place `ConfiguracionNegocio` (the single id=1 row) and the `EstadoCita` catalog are read
  from. It caches both for 60 s and always reads through `PrismaService`, **never** through a
  caller's `tx` — these are configuration, not data the booking transaction races over, and
  keeping them out of it is the point. Add a `catalogo.invalidar()` call to whatever handler
  eventually edits either table.
- **`SyncModule`** (`src/sync/`) is the integration point for the external API sync:
  - `external-api.config.ts` — registers the `externalApi` config namespace from env vars (`EXTERNAL_API_BASE_URL`, `EXTERNAL_API_KEY`, `EXTERNAL_API_TIMEOUT_MS`, `EXTERNAL_API_SYNC_CRON`).
  - `external-api.client.ts` — generic authenticated HTTP client (`get`/`post`) wrapping `@nestjs/axios`, reads base URL/key from `ConfigService`.
  - `sync.service.ts` — `runSync()` is the entry point for actual sync logic (currently a stub). A `@Cron` job exists but is `disabled: true` until the external API contract and sync cadence are defined.
  - `sync.controller.ts` — exposes `POST /sync`, `@Roles(Role.ADMIN)` only.
  - When the external API contract is defined, implement the real request/mapping inside `SyncService.runSync()` using `ExternalApiClient` rather than adding a new HTTP client.
- **`ProductosModule`** (`src/productos/`) es el catalogo de lo que se vende aparte del
  servicio. `GET /productos` y `GET /productos/categorias` son `@Public()` y devuelven solo
  lo publicado; `GET /productos/gestion` es `@Roles(ADMIN)` y devuelve tambien lo
  despublicado. Es **otra ruta** y no la publica con un parametro, a proposito: un
  `?incluirInactivos` deja la visibilidad dependiendo de que guard y servicio se pongan de
  acuerdo. `Producto` lleva **dos** indicadores separados, como `EstadoCita`: `activo` es
  "esta publicado" (no sale en la proyeccion publica: un visitante no tiene la nocion de un
  producto despublicado) y `disponible` es "hay existencias hoy" (si sale: es el chip de
  agotado). `DELETE /productos/:id` **despublica, no borra**. El catalogo no pagina, igual
  que `/servicios` y `/empleados`: la cota de `04-contrato-api.md` existe por `GET /citas`,
  que crece con cada reserva. Aqui el precio **si** llega en el cuerpo y se persiste — este
  es el sitio donde el precio se define, y la regla de "el servidor recalcula importes"
  habla justamente de que una reserva no puede traer el suyo.
- **`HealthController`** (`src/health/health.controller.ts`) exposes `@Public() GET /health`, used by the frontend to detect API availability without a token. It does **not** touch the database yet — it answers `ok` with MariaDB down.
- **Observabilidad** (`src/common/observabilidad/` + `src/telemetria/`) — `RequestIdMiddleware` stamps every request with `x-request-id` (validating any inbound one before reusing it), publishes it through an `AsyncLocalStorage` so every `new Logger(...)` in the codebase picks it up with no signature change, and returns it in the response header (exposed via CORS `exposedHeaders`, or the browser could not read it). `LoggerEstructurado` is passed to `NestFactory.create({ logger })` so bootstrap logs already have the format: JSON lines in production, Nest's `ConsoleLogger` outside it. `AccesoInterceptor` writes one `evento: 'peticion'` line per request (method, declared route, status, ms) and `ExcepcionesFilter` writes the `evento: 'excepcion'` line with the reason — **including 4xx now**, which used to leave no trace at all. `POST /telemetria/errores` (`@Public()`, rate-limited, tightly bounded DTO) ingests what only the browser sees. No table and no external APM on purpose: events go to stdout and rotation belongs to the process manager. Full reasoning: `apiBase/src/common/observabilidad/10-observabilidad.md`.
- CORS is enabled in `main.ts` for `process.env.CORS_ORIGIN` (defaults to the Vite dev origin `http://localhost:5173`) — update this env var, not the code, when the frontend origin changes.
- `LOG_FORMAT`/`LOG_LEVEL` are read from the real process environment **before** `ConfigModule` loads `.env`, because the logger exists from the first line of bootstrap. On a VPS the process manager sets them; locally `npm run start:prod` loads `.env` with `--env-file-if-exists`.
- `main.ts` applies a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — DTOs must use `class-validator` decorators (see `auth/dto/login.dto.ts`) to get request validation for free, and an unknown field is a 400 instead of being silently dropped. It also installs `helmet()`, a 64 kb body limit, the global `SobreInterceptor`/`ExcepcionesFilter` pair, and mounts `/docs` **only** outside production (it is raw Express middleware and never passes through the guards).
- Env vars, including `JWT_SECRET`/`JWT_EXPIRES_IN`, are documented in `apiBase/.env.example`; copy to `.env` locally.

### Template

- Component architecture, folder conventions, and styling rules (Tailwind CSS): see `Template/ARCHITECTURE.md`.
- Routing via `react-router-dom`, mounted in `src/main.tsx` (`ErrorBoundary` > `BrowserRouter` + `AuthProvider`) with the full route tree declared in `src/App.tsx`, wrapped in a top-level `AppLayout` route (Navbar/Footer chrome) that applies to every page.
- **Pages are organized by domain under `src/pages/`**, mirroring the backend:
  - `auth/` — `LoginPage`, `RegisterPage`.
  - `gestion/<domain>/` (`servicios`, `adicionales`, `empleados`, `horarios`, `restricciones`) — one `<Domain>ListPage` + one `<Singular>DetallePage` per domain, gated to admin/empleado. `gestion/productos/` es la excepcion: una sola `ProductosListPage` (lista + alta + edicion + despublicar en la misma pantalla, sin pagina de detalle) y **gated to admin only**, porque en el API hasta `GET /productos/gestion` es `@Roles(ADMIN)`.
  - `citas/` — `CitasListPage`, `AgendaPage`, `ReservarPage`, `EditarCitaPage`, `DetalleCitaPage`, gated to any authenticated role.
  - `publico/` — `LandingPage` (generic booking pitch + `/health` check), `ServiciosPage` (public service catalog — distinct from `gestion/servicios/ServiciosListPage`, which is the admin/empleado management view of the same domain), `EquipoPage` — ungated marketing pages. `ServiciosPage` and `EquipoPage` read the real catalog from `GET /servicios` and `GET /empleados`; there is no hardcoded catalog left in a page.
  - `sistema/` — `NotFoundPage` (`*`), `NoAutorizadoPage`, `EnConstruccionPage`.
  - Several page components are still placeholder shells (heading only): `AgendaPage`, the ten `gestion/` pages under the other five domains, and the three `sistema/` pages. Everything under `citas/` is implemented (`CitasListPage`, `DetalleCitaPage`, `EditarCitaPage`, `ReservarPage`, `ConfirmarCitaPage`), as are the three `auth/` pages and the four `publico/` pages — flesh out a page's real UI/logic in place, don't rename it.
- **Las citas son un solo tipo, no uno por pantalla.** `src/types/cita.ts` describe lo que
  devuelve `INCLUIR_CITA` en el backend, que es la proyeccion que usan por igual
  `GET /citas`, `GET /citas/:id`, `PATCH /citas/:id` y `DELETE /citas/:id`. La excepcion es
  `POST /citas`, que a un invitado le devuelve un comprobante mas estrecho
  (`CitaReservada` en `services/citasService.ts`) — no son intercambiables.
- **Que se puede hacer con una cita lo dice el servidor, no el frontend.** Cada cita trae su
  `estado` completo con `permiteEdicion`, `permiteCancelacionCliente`,
  `permiteCancelacionPersonal` y `esFinal`; `lib/permisosCita.ts` es el unico sitio que los
  lee y decide que boton se pinta. Ninguna pantalla escribe reglas como "una CONFIRMADA no
  la cancela el cliente": eso es una fila de `EstadoCita`. Y `EstadoBadge` mapea codigo a
  color con caida a neutro, porque alguien puede agregar un estado y eso no puede romper la
  lista.
- **`ProductosPage` hace dos lecturas, no una**: `GET /productos/categorias` trae el texto
  que ordena la pagina y `GET /productos` llena las rejillas — el mismo reparto que
  `EquipoPage`. Si falla cualquiera de las dos se muestra el error y no medio catalogo: el
  visitante no puede saber que le falta la otra mitad.
- **`lib/productosPlaceholder.ts` ya no existe.** Era el ultimo archivo del frontend con
  rubro; ese contenido vive ahora como filas de `CategoriaProducto`/`Producto` en
  `apiBase/prisma/seed.ts`, que es donde el rubro es dato y no codigo. Queda
  `lib/configuracionPlaceholder.ts` como unico placeholder, a la espera de
  `GET /configuracion`.
- **`src/hooks/useAccionApi.ts`** es la contraparte de `useRecursoApi` para las escrituras:
  devuelve `{ ejecutar, enviando, error, limpiarError }`, no lanza (devuelve `null` al
  fallar) e ignora las llamadas mientras hay una en vuelo, que es lo que evita que un doble
  clic mande dos cancelaciones. Las paginas no escriben su propio `try/catch` con `enviando`.
- **`src/hooks/useRecursoApi.ts`** is the only place a page reads an API resource from: it returns `{ datos, cargando, error }`, cancels on unmount, and keeps the API's own error text. Pages don't write their own `useEffect` + `useState` fetch triad.
- **`src/routes/ProtectedRoute.tsx`** redirects to `/auth/login` when not authenticated; **`src/routes/RoleRoute.tsx`** takes an `allow: Role[]` prop and redirects to `/sistema/no-autorizado` otherwise. Both are `react-router` layout routes (`<Route element={...}><Route .../></Route>`) — nest new gated routes under them in `App.tsx` rather than checking auth inside a page component.
- **La sesion se cierra sola al vencer, y se sincroniza entre pestanas.** `POST /auth/login`
  y `POST /auth/registro` devuelven `expiraEn` (ISO, derivado del `exp` firmado) junto al
  token; `tokenStorage` lo guarda al lado y `AuthContext` programa el cierre con 30 s de
  margen. No es autorizacion —el servidor revalida la firma en cada peticion—: evita que la
  sesion muera en el primer 401, a mitad de un formulario. El evento `storage` cubre el
  resto: salir en una pestana cierra las demas, y entrar en una recarga las otras.
- **`src/context/AuthContext.tsx`** (`useAuth()`) holds `token`/`role`/`usuario`, backed by `localStorage` via `src/api/client.ts`'s `tokenStorage` (token and expiry are written and cleared together — half a session is where the odd bugs come from). `login(token, role)`/`logout()` are the only mutators — call these from the login page once `POST /auth/login` returns a real token, don't write to `localStorage` directly elsewhere.
- **`src/api/client.ts`** is the single fetch wrapper for calling apiBase — reads `import.meta.env.VITE_API_URL` (defaults to `http://localhost:3000`) and auto-attaches the stored bearer token to every request. Exposes `get/post/patch/delete`. Its `ApiError` carries `status` **and** `requestId` (the `x-request-id` the server logged the failure under, so a screen can show a code you can `grep`); a `fetch` that never got a reply is an `ApiError` with status `SIN_RESPUESTA` (0) and a Spanish message, not the browser's raw `"Failed to fetch"`.
- **`src/lib/telemetria.ts`** reports browser-side failures to `POST /telemetria/errores` — render errors (via `components/layout/ErrorBoundary.tsx`, the only class component in the app), `window.onerror`, unhandled promise rejections, network failures and 5xx. It is the **one** deliberate exception to "nothing calls `fetch` outside `services/`": going through `apiClient` would let a failed report log the user out on a 401 or trigger another report. Dedupe (60 s) plus a 20-per-page-load cap keep a re-rendering error from flooding the API it is trying to diagnose. 4xx is never reported — the server already logged it under the same id.
- **Las tres pantallas de cuenta comparten armazon.** `components/layout/AuthShell.tsx` pone
  el eyebrow, el titulo, la bajada, el ancho y el pie de `LoginPage`, `RegisterPage` y
  `PerfilPage`; se habian escrito por separado y se habian separado (un `max-w-md` contra un
  `max-w-2xl`, un `PageHeader` contra un `h1` suelto). `enCard={false}` para una pantalla que
  trae sus propias cards, como el perfil.
- **`PerfilModal`** (abierto desde el boton de cuenta del navbar, con las iniciales) es el
  centro de cuenta: nombre, apellido, telefono, rol, enlace al perfil y **cerrar sesion**.
  Cerrar sesion ya no esta en la barra — ocupaba sitio permanente para algo que se usa una
  vez por sesion, y pegado a los enlaces de navegacion. `Iniciar sesion` sin sesion no cambio.
- **`src/services/`** has one thin file per backend resource that actually answers (`citasService`, `empleadosService`, `serviciosService`, `authService`), each just mapping methods 1:1 to `apiClient` calls for that resource's routes. There is deliberately no `horariosService`/`restriccionesService`/`adicionalesService`: those backend services are still stubs, so a frontend file for them would only be an unused wrapper over routes that throw. Add each one back together with the page that consumes it. Add new backend calls as a method here, in the matching resource file — don't call `apiClient`/`fetch` directly from a page/component.
- Env vars are documented in `Template/.env.example`.

### Cross-cutting

- Frontend origin and backend `CORS_ORIGIN` must stay in sync; frontend `VITE_API_URL` and backend listen port must stay in sync.
- No shared types/package between `apiBase` and `Template` yet — API response shapes are duplicated as TS types on the frontend (e.g. `HealthResponse` in `LandingPage.tsx`, `Rol` in `services/authService.ts`) until a shared contract is introduced. Keep the frontend `Rol` union and backend `Role` enum (`common/enums/role.enum.ts`) in sync manually when roles change — both are uppercase (`ADMIN`/`EMPLEADO`/`CLIENTE`), matching the Prisma enum.
- The persistence decision is **closed**: MariaDB/MySQL via Prisma, one database per business (no `negocioId` anywhere). The data model lives in `apiBase/prisma/schema.prisma`. The initial migration is applied (`apiBase/prisma/migrations/`) and `PrismaService` is wired to the `@prisma/adapter-mariadb` driver adapter Prisma 7 requires, reading `DATABASE_URL` through `ConfigService` — the API boots against a real database. Local MariaDB comes from `docker-compose.yml` at the repo root (`docker compose up -d`, pinned to `mariadb:11.4`, bound to `127.0.0.1` only); the VPS must run the same major version. Prisma CLI needs `--config prisma7.config.ts`, so use the `db:*` npm scripts in `apiBase` rather than bare `npx prisma`: `db:migrate` (dev, creates a shadow database, needs a privileged user) and `db:deploy` (production, no shadow database). The catalog seed is `apiBase/prisma/seed.ts` (`npm run db:seed`, also wired as the Prisma `migrations.seed` command so `migrate reset` reseeds): idempotent upserts with hardcoded UUID ids, because the citas DTOs validate `@IsUUID` — readable ids like `srv-1` are rejected at the edge before any service sees them. `DATOS_QUEMADOS` y `apiBase/src/demo/` ya no existen: el API solo habla con la base real.
- **Local infrastructure is one `docker-compose.yml` at the repo root**, and it holds only the pieces that are not Node: `db` (MariaDB, `127.0.0.1:3306`) and `waha` (WhatsApp HTTP API, published on `127.0.0.1:3001` because it listens on 3000 inside the container and the API already owns 3000 on the host). Both API and frontend run natively via npm — do not containerize them locally. The root `.env` feeds compose (WAHA keys, MariaDB password) and is a different file from `apiBase/.env`; both are gitignored, with `.env.example` beside each. WAHA is scaffolding for `09-conexion-whatsapp.md`: its session is not scanned yet and no code calls it.
- **El VPS es otra topologia, no la de local: una sola imagen.** `Dockerfile` (raiz)
  arma frontend + API + worker + WAHA en una imagen; `compose.vps.yml` la levanta junto
  a MariaDB, que es el unico servicio que queda fuera. Adentro, nginx (`docker/nginx.conf`)
  sirve `Template/dist` y manda `/api/` al API en `127.0.0.1:8080`, supervisor
  (`docker/supervisord.conf`) mantiene vivos los tres procesos, y `docker/entrypoint.sh`
  valida el entorno, migra y siembra antes de que nada escuche. Consecuencias que el
  codigo da por hechas ahi: el frontend sale por el mismo origen que el API (sin CORS),
  WAHA se alcanza en `127.0.0.1:3000` y su webhook vuelve por loopback, y el worker corre
  dentro del proceso del API. Nada de esto cambia como se trabaja en local, donde API y
  frontend siguen corriendo con npm. Pasos, secretos y pareo del numero: `DEPLOY.md`.
- **El despliegue lo dispara un push a `main`, y la imagen se compila en CI.**
  `.github/workflows/despliegue.yml` verifica (lint + pruebas + compilacion de los dos
  workspaces), publica `ghcr.io/relichtyy/citastemplate` y avisa a Dokploy, que baja la
  imagen. El VPS no compila nada. Al lado de `app` y `db` corren dos contenedores mas,
  los dos scripts montados desde `docker/`: `respaldo` (dump diario verificado, con
  retencion) y `vigia` (sonda `/health` y avisa a `ALERTA_WEBHOOK_URL`). A mano:
  `scripts/deploy.sh` (con vuelta atras automatica si `/health` no responde) y
  `scripts/restaurar.sh`. Las etiquetas de Traefik viven en `compose.vps.yml`, no en el
  panel de Dokploy: configurar el dominio en los dos lados es tener dos fuentes de verdad.
- **Documentation is three-layered, and the layers do different jobs.** Do not go hunting
  across files: the layer you need is already loaded or already beside the code.
  1. `CLAUDE.md` (this file, plus `apiBase/CLAUDE.md` and `Template/CLAUDE.md`) — invariants
     that apply to *everything* in that scope. Loaded automatically. Terse bullets, no prose.
  2. `<module>/NN-<name>.md` — one spec per component, sitting in that component's folder.
     Covers only what is specific to it and assumes the invariants above. Carries the
     reasoning and the trade-offs, which is what a bullet cannot.
  3. `SPEC.md` — closed decisions, implementation order, and the index of the ten specs.
- **A task should need one spec plus the ambient invariants.** If implementing something
  forces you to open a second spec, that is a defect in the structure, not in you — say so.
- When a spec and this file disagree, the spec wins.
