# 02 · Reservas y concurrencia

El componente con la única lógica no trivial del sistema. Todo lo de aquí vive en
`CitasService`; ningún controlador ni componente de React reimplementa nada de esto.

## Disponibilidad: una sola función

Crear y modificar una cita pasan por la **misma** función de verificación. Cinco reglas, en
este orden:

1. El día tiene al menos una franja activa en `HorarioAtencion`.
2. `[inicio, fin)` cae completo dentro de una de esas franjas.
3. No hay `RestriccionHorario` que traslape, ni general (`empleadoId` nulo) ni de ese empleado.
4. No hay otra `Cita` del **mismo empleado** que traslape y cuyo estado tenga
   `bloqueaDisponibilidad = true`.
5. El servicio está activo, el empleado está activo, y el servicio está asignado a ese empleado.

`fin` lo calcula el servidor: `inicio + Servicio.duracionMinutos`. Los adicionales suman
costo y nunca duración. El cliente no envía `fin`; si lo manda, se ignora.

Traslape es `inicioA < finB && inicioB < finA`. Extremos que se tocan no traslapan: una cita
que termina 10:00 y otra que empieza 10:00 conviven.

## La carrera

Verificar y después insertar, sin más, deja pasar a dos clientes simultáneos sobre el mismo
espacio. Es el defecto conocido del sistema anterior y no se hereda. Dos mecanismos, los dos
obligatorios:

**Restricción de unicidad.** `@@unique([empleadoId, slotOcupado])` en `Cita`. `slotOcupado`
es un espejo de `inicio` mientras el estado bloquea disponibilidad, y `NULL` cuando no.
MySQL admite NULLs repetidos en un índice único, así que una cita cancelada libera el
espacio aunque la fila siga existiendo — es el reemplazo del índice parcial que no tenemos
por estar en MySQL y no en PostgreSQL.

Cubre el caso real más frecuente: dos personas tocando el mismo horario ofrecido en
pantalla. **No** cubre traslapes parciales con horas de inicio distintas.

**Transacción.** Por eso la verificación y la inserción van dentro de una misma
`prisma.$transaction`, que es lo que cubre el traslape parcial. La violación de unicidad
(`P2002`) se captura y se traduce al mismo error de negocio que un traslape detectado.

Consecuencia obligatoria: **todo cambio de estado que altere `bloqueaDisponibilidad` debe
actualizar `slotOcupado` en la misma transacción.** Cancelar pone `NULL`; reabrir vuelve a
poner `inicio` y puede fallar por unicidad si alguien tomó el espacio, lo cual es correcto.
Si alguien olvida esto, el bug es silencioso: horarios que se ven ocupados para siempre.

## Importes

El API **recalcula** precio y total; nunca acepta importes del cliente.

```
precioServicio   = Servicio.precio            (leído de la base, al reservar)
costoAdicionales = suma de ServicioAdicional.precio de los adicionales elegidos
costoTotal       = precioServicio + costoAdicionales
```

El DTO de reserva acepta `servicioId`, `empleadoId`, `inicio` y una lista de `adicionalIds`.
Acepta además `clienteId` **opcional**, que solo `ADMIN` y `EMPLEADO` pueden mandar, para
reservar a nombre de otra persona; si un `CLIENTE` lo envía se ignora y se usa el suyo. En
ambos casos `registradaPorId` es siempre el usuario del token.
Cualquier campo de precio que llegue en el cuerpo lo descarta el `ValidationPipe`
(`whitelist: true`). `ReservarPage` puede mostrar un estimado, pero el importe que se guarda
es el que responde el API.

## Qué le toca al frontend

Nada de lo anterior. `ReservarPage` no simula disponibilidad ni con mocks locales: pide
horarios al API, y en el paso de confirmación muestra el error que el API devuelva
(traslape → 409). El texto que ve el usuario sale del `message` del sobre de respuesta, no
de una cadena inventada en el cliente. Ver `04`.
