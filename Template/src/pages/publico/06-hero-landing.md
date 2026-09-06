# 06 · Hero de la landing

Alcance: `Template/src/pages/publico/LandingPage.tsx`. Es la primera pantalla y la única
que un visitante ve sin sesión, así que carga sola el peso de la primera impresión.
Paleta y tokens: `05`.

## Composición

Una columna centrada, mucho aire, sin imagen decorativa. En minimalismo el espacio en
blanco es el recurso; una foto de stock lo abarata y además ataría el producto a un rubro.
`src/assets/hero.png` no se usa hoy y no se va a usar — se borra.

De arriba a abajo:

1. **Logo** — `ConfiguracionNegocio.logoUrl`, con `alt` igual al nombre del negocio.
   Altura máxima 56 px en móvil, 72 px desde `md`, ancho automático. Si `logoUrl` es nulo,
   se muestra el **nombre del negocio** como palabra, en `text-h` con tracking cerrado.
   Nunca aparece la cadena "CitasTemplate": es el nombre del repositorio, no de un producto.
2. **`h1`** — `ConfiguracionNegocio.eslogan` si existe; si no, un titular neutro de rubro.
   Un solo `h1` en la página.
3. **Bajada** — una línea, `text-text`, máximo ~60 caracteres. No repite el `h1`.
4. **Los dos botones.**

Entre bloques, escala de espaciado creciente hacia abajo: el aire entre el logo y el `h1` es
menor que el que separa la bajada de los botones. Es lo que hace que se lea como jerarquía y
no como una lista centrada.

## Los dos botones

| | Etiqueta | Variante | Destino |
|---|---|---|---|
| 1 | `Agendar Cita` | `primary` | `/citas/reservar` |
| 2 | `ConfiguracionNegocio.terminoEmpleadoPlural` | `secondary` | `/equipo` |

El segundo botón **no** dice "Especialistas" escrito en el componente. Sale del vocabulario
configurable: el valor por defecto es `"Especialistas"`, y un negocio que prefiera
"Profesionales", "Terapeutas" o "Técnicos" lo cambia en su configuración sin tocar código.
Es la regla de `05` aplicada al caso concreto que la motivó.

La ruta sigue siendo `/equipo`. Los nombres internos no cambian nunca; lo que cambia es lo
que el usuario lee.

Lado a lado desde `sm`, apilados y a ancho completo por debajo, con el primario arriba.
Ambos ya cumplen el objetivo táctil de 44 px con el `px-6 py-3` actual.

## Dos cosas que hay que resolver para que esto funcione

**Hacen falta enlaces con forma de botón.** `Button` renderiza un `<button>`, así que hoy la
landing duplica sus clases a mano dentro de un `<Link>` — y el `Navbar` hace lo mismo. Antes
del hero se extrae un `ButtonLink` que comparta las variantes de `Button`, y se reemplazan
las dos copias existentes. Un tercer duplicado sería el momento en que las variantes se
desincronizan.

**El botón principal manda a los invitados a un callejón.** `/citas/reservar` cuelga de
`ProtectedRoute`, así que un visitante sin sesión termina en el login sin forma de volver a
lo que quería hacer. Para el CTA central de un producto de reservas eso no es aceptable:
`ProtectedRoute` debe recordar el destino y el login debe devolver ahí después de entrar.
Es la única funcionalidad nueva que este spec exige.

## Qué se va

El indicador `API: online/offline` que la página muestra hoy fue andamiaje para verificar
la conexión durante el arranque, y no es información para un visitante. Sale de la vista.
Si conviene conservar el chequeo, que quede sin representación visual.

## Verificación

A 360, 768 y 1280 px. Sin scroll horizontal en ninguno. El hero completo —logo, titular y
ambos botones— visible sin desplazarse en un teléfono de 360×640. Foco visible con teclado
en los dos botones: `Button` hoy no define `focus-visible` y hay que agregarlo, usando
`--color-accent-border`.
