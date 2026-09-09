# 07 · Card de servicio

Componente compartido: `Template/src/components/ui/ServicioCard.tsx`. Los servicios varían
por negocio y salen del API, así que la card no asume nunca cuántos son, qué largo tienen
los nombres ni qué moneda usan.

Prioridad declarada: **se diseña para el teléfono**. El escritorio es el caso fácil y sale
solo; si hay que sacrificar algo, se sacrifica en pantalla ancha.

## Qué entra y qué no

Entra: **portada, nombre, duración y precio**, más el chevron que indica que hay detalle.

Queda fuera a propósito:

- **La descripción.** Es el campo que satura la lista y el que menos ayuda a elegir en una
  cuadrícula. Va en el detalle.
- **Los adicionales.** Pertenecen al flujo de reserva, no al catálogo.

Regla para futuras discusiones: agregar un **dato** a esta card exige quitar otro.

### La imagen entró, y por qué la objeción ya no aplica

Este spec la dejaba fuera con dos argumentos. El primero se resolvió; el segundo se pagó a
sabiendas.

**"Unas cards tendrían foto y otras no, y la grilla se ve rota."** Era el argumento de peso, y
deja de valer cuando el hueco de la foto lo llena algo con la misma forma: sin `imagenUrl`, la
portada muestra la **inicial del nombre** sobre `--color-accent-bg`, ocupando exactamente la
misma caja. Es el mismo mecanismo que ya justificaba el avatar del especialista
(`08-pagina-especialistas.md`), aplicado aquí. La condición es esa y no otra: **si algún día
el fallback deja de llenar la caja entera, la imagen vuelve al detalle.**

**"Es lo que más pesa y lo primero que satura 360 px."** Sigue siendo cierto y es un costo
aceptado, no eliminado. Se acota con `loading="lazy"` en `Thumbnail` —una rejilla de catálogo
casi nunca entra entera en pantalla— y con la relación de aspecto fija, que reserva el hueco
antes de que la imagen llegue y evita el salto. Lo que no se hace es servir la misma foto a
360 px y a 1280: cuando exista un endpoint que dé varios tamaños, aquí va un `srcset`.

La portada **no** es un dato más compitiendo en la cuadrícula de texto: vive encima de ella,
a sangre, y por eso no obliga a quitar nada de las dos filas de abajo.

## Estructura

Portada a sangre y, debajo, dos filas de contenido más el canalón del chevron, igual en móvil
y en escritorio:

```
┌────────────────────────────────────┐
│                                    │
│              PORTADA               │  a sangre, 4/3 (apaisada: no es un retrato)
│                                    │
├────────────────────────────────────┤
│ Corte y peinado                 ›  │  nombre, hasta 2 lineas · chevron
│ 45 min                  ₡ 12.500   │  duracion (muted) · precio (ambar)
└────────────────────────────────────┘
```

El relleno es del bloque de texto, no de la card: la foto tiene que llegar al borde. Por eso
la card usa `CARD_MEDIA_INTERACTIVE_CLASSES` y no la variante con `p-4`.

Sobre la foto va el **foco** (`foco-imagen`): los bordes y sobre todo el pie bajan de brillo,
para que el nombre no compita con la zona más clara de la imagen. Se aplica solo cuando hay
`img` de verdad —`group-has-[img]`, no el `src`, porque una URL podrida ya cayó al
monograma— y sobre el monograma se vería como un error de carga, no como foco.

El precio **no** comparte fila con el nombre. Es la decisión que hace que la card aguante
cualquier teléfono: un nombre largo empuja hacia abajo, nunca aplasta el precio. Nombre con
`line-clamp-2`; el precio con `whitespace-nowrap` y `tabular-nums`, para que no se parta ni
baile entre filas.

El chevron vive en su propia columna al borde derecho del bloque de texto, a la altura del
nombre —ya no centrado sobre el alto de la card, que ahora lo manda la portada—. El precio se
alinea al mismo borde una fila más abajo, así que los dos conviven en el lado derecho sin
tocarse.

Jerarquía: el precio es el elemento de mayor peso visual —tamaño y negrita, más
`--color-price`—, por encima del nombre. La duración es el dato más callado, en
`--color-text-muted`. El chevron es el más callado de todos: señal, no protagonista.

## Estilo

Extiende la primitiva `Card` existente; no la reimplementa. Dos ajustes que se hacen **en la
primitiva**, no solo en esta card, porque valen para todas las listas:

- `Card` usa `bg-bg`, el mismo fondo de la página. Con la paleta nueva pasa a
  `bg-surface`, para que la card se despegue del fondo.
- `Card` fija `p-6`. En 360 px eso deja el contenido en 312: baja a `p-4` y vuelve a `p-6`
  desde `sm`.

Toda la card es el objetivo táctil: es un `Link` a `/servicios/:id`, no un `div` con un
enlace adentro. Estado de foco visible, y `hover:border-accent-border` como ya hacen las
listas de gestión.

Esa ruta **no existe todavía**: hoy el único detalle de servicio es `/gestion/servicios/:id`,
que está detrás de `RoleRoute`, así que un visitante que tocara la card terminaría en
`/sistema/no-autorizado`. Hay que agregar `/servicios/:id` como página pública de detalle
—la que sí muestra descripción e imagen— con el botón de agendar. Sin ella la card no debe
ser enlace ni llevar chevron.

## Rejilla

Una columna hasta `sm`, dos en `sm`, tres desde `lg`. Nunca dos columnas en un teléfono: a
360 px cada card quedaría en ~170 px y el precio chocaría con la duración.

Separación `gap-3` en móvil, `gap-4` desde `sm`.

## Precio: formato

El símbolo de moneda **no** se escribe en el componente. Sale de
`ConfiguracionNegocio.moneda` y `locale`, y se formatea con `Intl.NumberFormat` en un helper
de `lib/`. Un negocio en otro país cambia dos campos de configuración y los precios se
muestran bien, sin tocar código.

`Servicio.precio` es `Decimal` en la base y viaja como cadena en el JSON: se formatea desde
esa cadena. Convertirlo a `number` en el camino introduce error de redondeo en importes.

## Duración

Se muestra en la unidad que se lee natural: `45 min`, y `1 h 30` a partir de 60 minutos.
Otro helper puro de `lib/`, porque el flujo de reserva lo va a necesitar igual.

## Dónde se usa

La misma card en los dos lugares —por eso es un componente compartido y no código de página:

- **`/equipo`**, en la sección de servicios que va debajo de los especialistas. Ver `08-pagina-especialistas.md`.
- **`/servicios`**, el catálogo completo del negocio, que sigue colgando del navbar.

Ambas rutas son públicas, así que dependen del endpoint público de solo lectura que
define: devuelve únicamente los `activo` y sin campos internos.

## Estados

`EmptyState` si no hay servicios, y **esqueleto** —no `Spinner`— mientras carga:
`SkeletonMediaCard` con la misma relación de aspecto que la portada.

Este spec decía lo contrario ("no hace falta esqueleto: a este volumen la lista llega antes de
que el salto de layout se note"). Eso valía cuando la card eran dos líneas de texto. Con una
portada de por medio el salto pasó a ser de cientos de píxeles por fila, que es exactamente lo
que un esqueleto existe para evitar: la premisa cambió con la imagen, no la opinión.

## Verificación

360, 768 y 1280 px. En 360, con un nombre de servicio de 40 caracteres y un precio de seis
dígitos, tienen que verse las dos cosas completas, el chevron sin encimarse, y sin scroll
horizontal. Ese es el caso de prueba: si pasa, la card está bien.
