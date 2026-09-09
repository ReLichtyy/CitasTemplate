# 08 · Página de Especialistas

Alcance: `Template/src/pages/publico/EquipoPage.tsx`, ruta `/equipo`. Es el destino del
segundo botón del hero y hoy es un placeholder de una línea.

Contiene **dos secciones apiladas**: los especialistas arriba, los servicios abajo. Es la
página que responde las dos preguntas que se hace alguien antes de reservar —quién me atiende
y qué cuesta— sin obligarlo a navegar.

## Estructura

```
h1   Especialistas          <- terminoEmpleadoPlural
     [rejilla de EspecialistaCard]

h2   Servicios              <- terminoServicioPlural, id="servicios"
     [rejilla de ServicioCard]
```

Los dos títulos salen del vocabulario configurable, no escritos en el componente: un taller
verá "Técnicos" y "Reparaciones" sin que nadie toque un `.tsx`.

Un solo `h1`, el de la primera sección, porque la página es la de especialistas y los
servicios son el complemento. La sección de servicios lleva `id="servicios"` para que se
pueda enlazar directo desde el navbar o el hero.

Separación generosa entre secciones —más que entre cards— o las dos rejillas se leen como
una sola lista larga. Es el error más probable de esta página.

## EspecialistaCard

Componente nuevo: `components/ui/EspecialistaCard.tsx`. Misma primitiva `Card` y mismo
chevron que `ServicioCard`, pero **la foto manda**: es una card de retrato, no una fila.

```
┌──────────────────────┐
│                      │
│        FOTO          │  a sangre: 1/1 en movil, 4/5 desde sm
│                      │
├──────────────────────┤
│ Joshua Calero  4.8 › │  nombre (hasta 2 lineas) · rating · chevron
│ Barbero senior       │  especialidad, una linea
└──────────────────────┘
```

Entra: **foto, nombre, especialidad y rating.** Nada más. La `bio` va en el detalle, por lo
mismo que la descripción del servicio no va en su card.

**La foto se sostiene en su reemplazo.** `Empleado.fotoUrl` es opcional, pero aquí hay un
sustituto con la misma forma: las **iniciales** del nombre sobre `--color-accent-bg`, en
`--color-accent`, llenando la misma caja que llenaría la foto. Toda card mide igual haya foto
o no, y la rejilla no se ve rota.

Ese mecanismo era, al principio, la diferencia entre esta card y la de servicio —una persona
tiene iniciales creíbles y un servicio no—. Ya no lo es: el servicio usa la **inicial de su
nombre** con el mismo criterio, así que las dos cards llevan portada y comparten
`CardCover`. Lo que se mantiene es la condición, no la excepción: **portada solo mientras el
fallback llene la caja entera.**

Esa condición —el fallback llena la caja entera— es lo que permite **agrandar** la foto sin
romper nada, y es la razón de que la card haya pasado del avatar `size-12` a un retrato a
sangre. Si alguna vez el fallback deja de ocupar el mismo hueco que la foto, la card vuelve a
la fila.

Relación de aspecto `aspect-square` en móvil y `sm:aspect-4/5` desde `sm`: a una columna, un
4/5 obliga a scrollear una card entera por persona. La de servicio es `aspect-4/3` —apaisada,
porque no es un retrato—; es el único parámetro que las separa.

Foto con `object-cover`, algo desaturada en reposo y a color completo con el `hover` de la
card, más un acercamiento de `scale-105` —por eso el contenedor recorta—. Encima va el
**foco** (`foco-imagen`): bordes y pie con menos brillo, para que el nombre no compita con la
zona más clara de la foto. Solo con `img` de verdad: sobre las iniciales, oscurecer se lee
como error de carga.

En el **detalle** la imagen va limpia —sin foco ni desaturación— y más grande: ahí la foto es
el contenido, no el fondo de un título.

Iniciales derivadas de `nombre` y `apellido`; nunca colores aleatorios por persona, que es
justo el tipo de detalle que satura.

El relleno **no** es de la card sino del bloque de texto: la foto tiene que llegar al borde.
Por eso `Card` expone `CARD_MEDIA_INTERACTIVE_CLASSES` —cáscara, recorte y comportamiento,
sin `p-4`— además de la variante con relleno. No se resuelve concatenando un `p-0`: dos
utilidades de la misma especificidad las ordena la hoja generada, no la plantilla.

Nombre en `text-h`, especialidad debajo en `--color-text-muted`. Si `especialidadId` es nulo,
la segunda línea se omite y la card se encoge; no se rellena con un guion.

Enlaza a `/equipo/:id`, página pública de detalle que **tampoco existe todavía** y hay que
crear, con la misma condición que el detalle de servicio: sin ella, no hay enlace ni chevron.

## Rejilla

Igual que la de servicios: una columna hasta `sm`, dos en `sm`, tres desde `lg`, `gap-3` /
`gap-4`. Las dos secciones comparten la misma rejilla a propósito — dos rejillas distintas en
la misma página se ven como un error de maquetación.

Lo que comparten es la **geometría** —columnas y separación—, no el alto de la card: la de
especialista es un retrato y la de servicio una fila de dos líneas. Son dos tipos de
contenido en dos secciones separadas por mucho aire; lo que se leería como error de
maquetación es que no coincidieran las columnas, no que no coincidan los altos.

## Datos

Dos peticiones independientes, cada una por su servicio de `services/`:
`empleadosService.listPublico()` y `serviciosService.listPublico()`. No se anidan: que los
servicios tarden no debe retrasar a los especialistas, y cada sección resuelve su propio
`Spinner` y su propio `EmptyState`.

Ambos endpoints son los públicos de solo lectura: solo registros `activo`, solo
campos públicos. En particular la respuesta de empleados **no** incluye el `Usuario`
completo: nombre, apellido, especialidad, foto y nada más. El teléfono es la credencial de
acceso, así que filtrarlo no es opcional.

## Qué pasa con `/servicios`

Sigue existiendo como catálogo completo colgado del navbar, con la misma `ServicioCard`. La
sección de esta página y esa ruta muestran lo mismo; no se duplica código porque la card y el
servicio de datos son compartidos. Si más adelante molesta tener las dos entradas, lo que se
quita es el enlace del navbar, no la ruta — el detalle `/servicios/:id` cuelga de ella.

## Verificación

360, 768 y 1280 px. En 360: nombres largos de especialista con `line-clamp-2`, iniciales
legibles, chevrones alineados en ambas rejillas, y las dos secciones claramente separadas al
hacer scroll. Sin scroll horizontal.

Dos casos propios de la portada: una rejilla donde **solo algunos** tienen `fotoUrl` —las
cards tienen que seguir midiendo igual— y el paso de cargando a cargado, que no puede saltar.
Las dos secciones usan `SkeletonMediaCard`, cada una con el `aspecto` de su card: `aspect-square
sm:aspect-4/5` la de especialistas, `aspect-4/3` la de servicios. Un placeholder con otra
forma es el propio salto que se quería evitar.

## Estado · conectado a la base

Las dos secciones salen de `GET /empleados` y `GET /servicios`, en **dos peticiones
independientes**: que el catalogo de servicios tarde o falle no deja en blanco la seccion de
especialistas, que puede estar lista. Cada seccion resuelve su propio cargando / error /
vacio (`EstadoSeccion` en la misma pagina).

El `rating` ya no es inventado: existe el modelo `Resena` (`prisma/schema.prisma`) y
`EmpleadosService` devuelve promedio, total y las tres ultimas **ya calculados**. Dos cosas
que se decidieron ahi y esta pagina asume:

- Solo salen las resenas con `publicada: true`. Una resena existe desde que se escribe, pero
  entra al catalogo cuando alguien la aprueba.
- Sin resenas publicadas, `rating` es **null** y no un cero: cero se lee como mala
  calificacion, y "sin opiniones todavia" no es eso. La card lo distingue.

Falta el flujo que **crea** resenas. Cuando exista debe colgar de una cita atendida — sin
eso, nada impide que la misma persona opine diez veces.
