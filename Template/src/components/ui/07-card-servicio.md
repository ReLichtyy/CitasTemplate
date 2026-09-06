# 07 · Card de servicio

Componente compartido: `Template/src/components/ui/ServicioCard.tsx`. Los servicios varían
por negocio y salen del API, así que la card no asume nunca cuántos son, qué largo tienen
los nombres ni qué moneda usan.

Prioridad declarada: **se diseña para el teléfono**. El escritorio es el caso fácil y sale
solo; si hay que sacrificar algo, se sacrifica en pantalla ancha.

## Qué entra y qué no

Entra: **nombre, duración y precio**, más el chevron que indica que hay detalle.

Queda fuera a propósito:

- **La descripción.** Es el campo que satura la lista y el que menos ayuda a elegir en una
  cuadrícula. Va en el detalle.
- **La imagen.** `Servicio.imagenUrl` es opcional, así que en un catálogo real unas cards
  tendrían foto y otras no, y la grilla se ve rota. Además es lo que más pesa y lo primero
  que satura 360 px. Va en el detalle, que es donde el espacio sobra.
- **Los adicionales.** Pertenecen al flujo de reserva, no al catálogo.

Regla para futuras discusiones: agregar un dato a esta card exige quitar otro.

## Estructura

Dos filas de contenido más el canalón del chevron, igual en móvil y en escritorio:

```
┌────────────────────────────────────┐
│ Corte y peinado                    │  nombre, hasta 2 lineas
│                                 ›  │  chevron: canalon fijo, centrado
│ 45 min                  ₡ 12.500   │  duracion (muted) · precio (ambar)
└────────────────────────────────────┘
```

El precio **no** comparte fila con el nombre. Es la decisión que hace que la card aguante
cualquier teléfono: un nombre largo empuja hacia abajo, nunca aplasta el precio. Nombre con
`line-clamp-2`; el precio con `whitespace-nowrap` y `tabular-nums`, para que no se parta ni
baile entre filas.

El chevron vive en su propia columna al borde derecho, centrado sobre el alto de la card. El
precio se alinea al borde del **contenido**, no al de la card, así que los dos conviven en el
lado derecho sin tocarse.

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

Se reutiliza el patrón que ya existe: `Spinner` mientras carga, `EmptyState` si no hay
servicios. No hace falta esqueleto de carga: a este volumen la lista llega antes de que el
salto de layout se note, y sería otro componente que mantener.

## Verificación

360, 768 y 1280 px. En 360, con un nombre de servicio de 40 caracteres y un precio de seis
dígitos, tienen que verse las dos cosas completas, el chevron sin encimarse, y sin scroll
horizontal. Ese es el caso de prueba: si pasa, la card está bien.
