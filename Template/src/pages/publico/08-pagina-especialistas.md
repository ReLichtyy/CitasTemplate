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

Componente nuevo: `components/ui/EspecialistaCard.tsx`. Mismo esqueleto que
`ServicioCard`, misma primitiva `Card`, mismo chevron.

```
┌────────────────────────────────────┐
│ ( JC )  Joshua Calero           ›  │
│         Barbero senior             │
└────────────────────────────────────┘
```

Entra: **avatar, nombre y especialidad.** Nada más. La `bio` va en el detalle, por lo mismo
que la descripción del servicio no va en su card.

**El avatar resuelve el problema que la imagen del servicio no podía.** `Empleado.fotoUrl`
también es opcional, pero aquí sí hay un reemplazo con la misma forma: las **iniciales** del
nombre sobre `--color-accent-bg`, en `--color-accent`. Toda card mide igual haya foto o no,
y la rejilla no se ve rota. Por eso el especialista lleva imagen y el servicio no: no es
inconsistencia, es que existe un fallback creíble para una persona y no para un servicio.

Círculo `size-12` en móvil y `sm:size-14` desde `sm` (48 y 56 px), `shrink-0`. Foto con
`object-cover`. Iniciales
derivadas de `nombre` y `apellido`; nunca colores aleatorios por persona, que es justo el
tipo de detalle que satura.

Nombre en `text-h`, especialidad debajo en `--color-text-muted`. Si `especialidadId` es nulo,
la segunda línea se omite y la card se encoge; no se rellena con un guion.

Enlaza a `/equipo/:id`, página pública de detalle que **tampoco existe todavía** y hay que
crear, con la misma condición que el detalle de servicio: sin ella, no hay enlace ni chevron.

## Rejilla

Igual que la de servicios: una columna hasta `sm`, dos en `sm`, tres desde `lg`, `gap-3` /
`gap-4`. Las dos secciones comparten la misma rejilla a propósito — dos rejillas distintas en
la misma página se ven como un error de maquetación.

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
