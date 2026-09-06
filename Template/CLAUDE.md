# Template — invariantes

Se cargan solas al trabajar en este workspace. Son las reglas que aplican a **todo** el
frontend; los specs de cada vista (`src/05-…`, `src/components/ui/07-…`,
`src/pages/publico/06-…` y `08-…`) solo cubren lo propio de esa vista y dan estas por sabidas.

## Estilos

- Tailwind v4, **utilidades canónicas**: `w-105` y no `w-[420px]`, `px-2.25` y no `px-[9px]`,
  `size-12` y no `h-12 w-12`, `bg-linear-to-b`, `wrap-break-word`, `shrink-0`,
  `outline-hidden`, `bg-black/50`. Los corchetes son la última salida.
- Ojo con las escalas que v4 corrió: `shadow` → `shadow-sm`, `shadow-sm` → `shadow-xs`, e
  igual con `rounded` y `blur`. El nombre de v3 no da error, aplica otro valor.
- **Ningún color fuera de los tokens de `@theme`.** Ni un hex en un componente, ni un color
  de la paleta de Tailwind (`text-red-500`). Si falta un tono, se agrega token.
- Un valor arbitrario que aparece dos veces es un token que falta.

## Adaptabilidad

- Mobile-first: sin prefijo es el teléfono, `sm:`/`md:`/`lg:` agregan. Nunca al revés.
- Piso de 360 px. Ninguna página hace scroll horizontal; desborda el contenedor del elemento
  ancho, con `overflow-x-auto`.
- Objetivos táctiles `min-h-11`.
- Catálogos públicos: rejilla de cards en todos los anchos. Solo las listas de gestión pasan
  a tabla desde `md`.
- Se verifica a 360, 768 y 1280 antes de dar una vista por terminada.

## Componentes

- Toda card que navega lleva el chevron de `CardDetailIcon`; la que no navega, no lo lleva.
  El icono es la promesa de que tocar hace algo.
- Iconos como SVG en línea en `components/ui/`, con `currentColor` y `aria-hidden`. Sin
  librería mientras sean menos de ocho.
- Foco visible siempre: `focus-visible:outline-hidden` más un anillo con el token del acento.
- Ningún componente ni página llama `fetch` o `apiClient`. Todo pasa por `services/`.

## Marca

Nombre, logo, colores y vocabulario salen de `ConfiguracionNegocio`, nunca escritos en un
`.tsx`. Criterio: cambiar de rubro no debe requerir editar ningún componente. Los nombres
internos —rutas, carpetas, props— no cambian nunca; cambia lo que el usuario lee.
