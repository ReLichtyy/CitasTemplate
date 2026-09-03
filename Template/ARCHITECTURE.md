# Template — arquitectura de componentes

Spec de como se organiza el frontend a partir de ahora. El backend/contrato de API queda fuera de este documento (se define aparte).

## Carpetas

```
src/
  components/
    layout/   # chrome de la app: Navbar, Footer, AppLayout. Uno de cada uno, no reusable entre paginas.
    ui/       # primitivas presentacionales reusables: Button, Card, Spinner, EmptyState, PageHeader.
  pages/      # una carpeta por dominio, un archivo por ruta. Mirror del backend (auth/, citas/, gestion/<dominio>/, publico/, sistema/).
  routes/     # guards de routing (ProtectedRoute, RoleRoute).
  services/   # una funcion por endpoint de backend, agrupadas por dominio. Unico lugar que llama apiClient.
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

## Pendiente (no cubierto en este pass)

- **Tipos de dominio reales** (`Cita`, `Empleado`, `Servicio`, etc.) — hoy los services devuelven `unknown`/`any` porque el contrato de API no esta definido. Los tipos usados en `ServiciosListPage`/`ServicioDetallePage` (`ServicioListItem`, `ServicioDetail`) son placeholders de forma, no el contrato real.
- `authService` no tiene `register`/`logout`/`me` pese a que `RegisterPage` existe como ruta.
- Sin libreria de data-fetching (react-query/swr) — todo es `useEffect` + `useState` manual. Revisar si vale la pena introducir una cuando haya mas paginas con fetching real.
