# 05 · Marca genérica y adaptabilidad

Las dos propiedades que definen el producto: sirve a cualquier negocio de reservas, y se usa
igual desde un teléfono. Hoy ninguna de las dos está implementada.

## Genérico: dónde vive el rubro

La regla ya escrita —ninguna entidad codifica un tipo de negocio— se cumple en el modelo de
datos, pero faltaba el mecanismo del lado visible. Hoy `Navbar.tsx` dice literalmente
`CitasTemplate` y `index.css` fija `--color-accent: #aa3bff`.

Todo lo que identifica al negocio sale de `ConfiguracionNegocio` (una fila) y de los tokens
de `@theme`. Nada más.

- **Nombre, eslogan, logo, contacto, dirección** → campos de la tabla, servidos por
  `GET /configuracion` público, cargados una vez al iniciar la app. Ningún componente
  escribe un nombre de negocio.
- **Color de acento** → `ConfiguracionNegocio.colorAcento` se inyecta sobre
  `--color-accent` en la raíz del documento. Los componentes siguen usando `bg-accent` y
  nunca un hex.
- **Vocabulario** → `terminoServicio` / `terminoEmpleado` y sus plurales. Es lo que permite
  que la misma app diga "Tratamiento" o "Sesión", "Profesional" o "Técnico", sin tocar
  código. Los títulos y encabezados los leen de ahí; los nombres internos (rutas, tablas,
  módulos) **no** cambian nunca.

Criterio para saber si se cumple: *cambiar de rubro no debe requerir editar ningún `.tsx`.*
Si para pasar de una clínica a un taller hay que abrir un componente, el mecanismo falló.

Lo que **no** es configurable: el flujo de reserva, la matriz de permisos y los estados de
cita como concepto. Configurable no es lo mismo que arbitrario.

## Adaptable: reglas

Hoy hay **cero** breakpoints de Tailwind en todo `Template/src`, y el `Navbar` es una fila
fija de seis enlaces más un botón — se rompe en un teléfono. Estas son las reglas de la
pasada responsive:

**Mobile-first.** Las clases sin prefijo son la versión de teléfono; `sm:`/`md:`/`lg:`
agregan a partir de ahí. Nunca al revés.

**360 px es el piso.** Si algo se desborda horizontalmente a 360, es un defecto, no un
detalle. Ninguna página hace scroll horizontal: el que desborda es el contenedor del
elemento ancho (tabla, calendario), con `overflow-x-auto`.

**Navbar con menú móvil.** Bajo `md`, los enlaces colapsan en un botón. Es el primer arreglo
y el más visible.

**Listas de gestión: `Card` en móvil, tabla desde `md`.** No se meten seis columnas en 360 px. El patrón
de `Card` que ya existe es la versión angosta. Aplica solo a las vistas de gestión, que
tienen muchas columnas: los catálogos públicos (servicios, equipo) **nunca** se vuelven
tabla, son rejilla de cards en todos los anchos. Ver `07`.

**Objetivos táctiles de 44 px** de alto mínimo en cualquier cosa que se toque. Afecta sobre
todo al selector de horarios de `ReservarPage`, que es una grilla de objetivos chicos.

**El selector de fecha y hora es el caso difícil.** Es la pantalla que decide si el producto
se puede usar desde un teléfono. Se diseña primero en angosto y después se ensancha.

**Se verifica a 360, 768 y 1280** antes de dar por terminada una página.

## Paleta

Criterio: elegante y minimalista significa **un solo acento y una rampa neutra rica**, no
varios colores. La tonalidad se nota en los neutros —que son cálidos, no grises puros— y en
la profundidad del acento, no en cantidad de matices. Un fondo blanco puro con gris frío es
la firma visual del template genérico; se evita a propósito.

El acento es un **petróleo profundo**: serio sin ser corporativo, y sobre todo neutral de
rubro — no dice clínica ni salón ni taller. Es el requisito que manda, porque el producto
tiene que servir a cualquiera.

Tokens en `@theme` de `src/index.css`. Reemplazan por completo a los actuales.

| Token | Claro | Oscuro |
|---|---|---|
| `--color-bg` | `#FAF9F7` | `#121311` |
| `--color-surface` | `#FFFFFF` | `#1A1B19` |
| `--color-border` | `#E6E2DC` | `#2B2C29` |
| `--color-text` | `#6A655E` | `#A7A29B` |
| `--color-text-h` | `#171614` | `#F1EFEB` |
| `--color-text-muted` | `#97918A` | `#7C776F` |
| `--color-accent` | `#12514E` | `#57B8B0` |
| `--color-accent-fg` | `#FFFFFF` | `#0B1F1E` |
| `--color-danger` | `#A03328` | `#E0796B` |

Se conserva además `--color-code-bg` (`#F4F3EC` claro, `#1F2028` oscuro): `index.css` lo usa
para el estilo de `code`. Sacarlo de la tabla sin sacar también esa regla deja el elemento
sin fondo.

Los tonos derivados **no** se escriben a mano: se calculan del acento, para que cambiar un
solo hex regenere la escala completa.

```css
--color-accent-hover:  color-mix(in oklab, var(--color-accent) 84%, black);
--color-accent-bg:     color-mix(in oklab, var(--color-accent) 10%, transparent);
--color-accent-border: color-mix(in oklab, var(--color-accent) 35%, transparent);
```

Es lo que hace viable el override de `ConfiguracionNegocio.colorAcento`: se inyecta
únicamente sobre `--color-accent` y lo demás se recalcula. Contrapartida a saber: Tailwind
no aplica modificadores de opacidad (`bg-accent-bg/50`) sobre valores `color-mix`; si hace
falta transparencia, se define otro token.

**Contraste.** Cuerpo y encabezados deben llegar a 4.5:1 contra su fondo, y `accent-fg`
contra `accent` también. Los valores de la tabla están elegidos para cumplirlo, pero quien
implemente **verifica con una herramienta** antes de dar por buena la pasada — sobre todo
`--color-text`, que es el más justo.

### Dos cosas que la paleta destapa

`Button` (variante `primary`) y el enlace del hero usan `text-white` fijo. Con un acento
configurable, un negocio que elija un color claro se queda con blanco sobre claro. Pasa a
`text-accent-fg`.

`LandingPage` usa `text-red-500`, un color de Tailwind sin token. Pasa a `--color-danger`.
Ningún componente vuelve a nombrar un color que no sea token.

### La única excepción al acento único

`--color-price`, un ámbar cálido, es el contrapunto del petróleo y el **único** segundo
matiz del sistema. Existe porque el precio es el dato que decide una compra y tiene que
saltar; usar el acento lo dejaría indistinguible de los enlaces.

| Token | Claro | Oscuro |
|---|---|---|
| `--color-price` | `#A65E1B` | `#E8A857` |

Es una excepción declarada, no una puerta abierta: cualquier color adicional necesita una
justificación del mismo peso, y por defecto la respuesta es no. Los valores son deliberadamente
profundos —un ámbar más brillante no llega a 4.5:1 sobre el fondo— y como el precio se
compone grande y en negrita, le aplica el umbral de 3:1 de texto grande, con margen de sobra.

## Iconos y la señal de que algo navega

**Toda card que navega lleva un chevron.** Hoy las cards de gestión ya son enlaces y no lo
dicen: nada distingue una card que abre un detalle de una que solo muestra datos. La señal
es un chevron (`›`) en un canalón fijo al borde derecho, centrado verticalmente sobre el alto
de la card, en `--color-text-muted` y pasando a `--color-accent` en `hover` y `focus`.

El canalón es una columna propia con `shrink-0`: el contenido nunca lo invade, y el chevron
nunca empuja al texto. Es lo que permite que en la card de servicio el precio y el chevron
convivan en el borde derecho sin pelearse — el precio se alinea al borde del contenido, el
chevron queda por fuera.

Una card que **no** navega no lleva chevron. El icono es la promesa de que tocar hace algo;
ponerlo por decoración la rompe.

**Sin librería de iconos.** Se necesitan dos —el chevron y el botón de menú del navbar— y
una dependencia para eso no se paga. Van como SVG en línea dentro de
`components/ui/icons.tsx`, con `currentColor` en el trazo para que hereden el color del
contexto y `aria-hidden="true"` porque son decorativos: el texto de la card ya dice a dónde
va. Si el catálogo pasa de ocho iconos, ahí sí se reevalúa traer una librería.
