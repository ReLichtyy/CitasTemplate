# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Dating app base project. Two independent npm workspaces, not yet linked by any tooling (no monorepo config, no root `package.json`):

- `apiBase/` — NestJS backend. Owns the REST API and sync with an external API (contract not yet defined).
- `Template/` — React + Vite frontend. Owns the public-facing app (home page first).

Each directory is built, linted, and tested independently — always `cd` into the relevant one before running commands.

## Commands

### apiBase (NestJS)

```bash
cd apiBase
npm run start:dev      # watch mode, http://localhost:3000
npm run build           # nest build (tsc)
npm run lint            # oxlint src/ test/
npm run test             # vitest run (unit)
npm run test:watch
npm run test:e2e         # vitest run --config ./vitest.config.e2e.ts
npm run test:cov
```

Run a single test file: `npx vitest run src/path/to/file.spec.ts`.

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
- **`AuthModule`** (`src/auth/`) has the JWT strategy (`strategies/jwt.strategy.ts`) and `POST /auth/login` (`@Public()`). `AuthService.login` currently throws `NotImplementedException` — there is no user store/persistence wired up yet; implement real credential validation there once a DB is chosen.
- **Domain modules** (`src/citas/`, `src/empleados/`, `src/servicios/`, `src/horarios/`, `src/restricciones/`, `src/adicionales/`) all follow the same controller → service shape, each service currently a stub (`findAll` returns `[]`, everything else throws `NotImplementedException`). `citas` is the odd one out: any authenticated role can hit `GET/POST/DELETE /citas*` (the service is expected to scope results to "own" vs "all" per role internally), while `PATCH` is `Roles(ADMIN, EMPLEADO)` only. The other domains are `gestion` (catalog/resource admin): reads are `Roles(ADMIN, EMPLEADO)`, writes are `Roles(ADMIN)` only.
- **`SyncModule`** (`src/sync/`) is the integration point for the external API sync:
  - `external-api.config.ts` — registers the `externalApi` config namespace from env vars (`EXTERNAL_API_BASE_URL`, `EXTERNAL_API_KEY`, `EXTERNAL_API_TIMEOUT_MS`, `EXTERNAL_API_SYNC_CRON`).
  - `external-api.client.ts` — generic authenticated HTTP client (`get`/`post`) wrapping `@nestjs/axios`, reads base URL/key from `ConfigService`.
  - `sync.service.ts` — `runSync()` is the entry point for actual sync logic (currently a stub). A `@Cron` job exists but is `disabled: true` until the external API contract and sync cadence are defined.
  - `sync.controller.ts` — exposes `POST /sync`, `@Roles(Role.ADMIN)` only.
  - When the external API contract is defined, implement the real request/mapping inside `SyncService.runSync()` using `ExternalApiClient` rather than adding a new HTTP client.
- **`HealthController`** (`src/health/health.controller.ts`) exposes `@Public() GET /health`, used by the frontend to detect API availability without a token.
- CORS is enabled in `main.ts` for `process.env.CORS_ORIGIN` (defaults to the Vite dev origin `http://localhost:5173`) — update this env var, not the code, when the frontend origin changes.
- `main.ts` applies a global `ValidationPipe({ whitelist: true, transform: true })` — DTOs must use `class-validator` decorators (see `auth/dto/login.dto.ts`) to get request validation for free.
- Env vars, including `JWT_SECRET`/`JWT_EXPIRES_IN`, are documented in `apiBase/.env.example`; copy to `.env` locally.

### Template

- Component architecture, folder conventions, and styling rules (Tailwind CSS): see `Template/ARCHITECTURE.md`.
- Routing via `react-router-dom`, mounted in `src/main.tsx` (`BrowserRouter` + `AuthProvider`) with the full route tree declared in `src/App.tsx`, wrapped in a top-level `AppLayout` route (Navbar/Footer chrome) that applies to every page.
- **Pages are organized by domain under `src/pages/`**, mirroring the backend:
  - `auth/` — `LoginPage`, `RegisterPage`.
  - `gestion/<domain>/` (`servicios`, `adicionales`, `empleados`, `horarios`, `restricciones`) — one `<Domain>ListPage` + one `<Singular>DetallePage` per domain, gated to admin/empleado.
  - `citas/` — `CitasListPage`, `AgendaPage`, `ReservarPage`, `EditarCitaPage`, `DetalleCitaPage`, gated to any authenticated role.
  - `publico/` — `LandingPage` (the original home page, now at `/`), `EspecialidadesPage`, `EquipoPage` — ungated marketing pages.
  - `sistema/` — `NotFoundPage` (`*`), `NoAutorizadoPage`, `EnConstruccionPage`.
  - All page components are currently placeholder shells (heading only) except `LandingPage`, which does the real `/health` check — flesh out a page's real UI/logic in place, don't rename it.
- **`src/routes/ProtectedRoute.tsx`** redirects to `/auth/login` when not authenticated; **`src/routes/RoleRoute.tsx`** takes an `allow: Role[]` prop and redirects to `/sistema/no-autorizado` otherwise. Both are `react-router` layout routes (`<Route element={...}><Route .../></Route>`) — nest new gated routes under them in `App.tsx` rather than checking auth inside a page component.
- **`src/context/AuthContext.tsx`** (`useAuth()`) holds `token`/`role`, backed by `localStorage` via `src/api/client.ts`'s `tokenStorage`. `login(token, role)`/`logout()` are the only mutators — call these from the login page once `POST /auth/login` returns a real token, don't write to `localStorage` directly elsewhere.
- **`src/api/client.ts`** is the single fetch wrapper for calling apiBase — reads `import.meta.env.VITE_API_URL` (defaults to `http://localhost:3000`) and auto-attaches the stored bearer token to every request. Exposes `get/post/patch/delete`.
- **`src/services/`** has one thin file per backend resource (`citasService`, `empleadosService`, `serviciosService`, `horariosService`, `restriccionesService`, `adicionalesService`, `authService`), each just mapping methods 1:1 to `apiClient` calls for that resource's routes. Add new backend calls as a method here, in the matching resource file — don't call `apiClient`/`fetch` directly from a page/component.
- Env vars are documented in `Template/.env.example`.

### Cross-cutting

- Frontend origin and backend `CORS_ORIGIN` must stay in sync; frontend `VITE_API_URL` and backend listen port must stay in sync.
- No shared types/package between `apiBase` and `Template` yet — API response shapes are duplicated as TS types on the frontend (e.g. `HealthResponse` in `LandingPage.tsx`, `Role` in `services/authService.ts`) until a shared contract is introduced. Keep the frontend `Role` union and backend `Role` enum (`common/enums/role.enum.ts`) in sync manually when roles change.
- Almost every domain service on the backend is a stub (`NotImplementedException`) and there is no persistence layer yet — implementing real behavior there and choosing a DB/ORM is the next foundational step, not a per-feature detail.
