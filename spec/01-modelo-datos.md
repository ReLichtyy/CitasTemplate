# 01 · Modelo de datos

Fuente de verdad: `apiBase/prisma/schema.prisma`. Este archivo explica lo que el esquema
no puede decir por sí solo. Si los dos se contradicen, gana el esquema y este archivo se
corrige.

11 modelos y 3 enums. Ninguno nombra un rubro de negocio.

## Invariantes

**`ConfiguracionNegocio` tiene exactamente una fila, `id = 1`.** El servicio siempre lee y
escribe esa fila; nunca crea otra. Es el único punto del sistema donde el producto deja de
ser genérico.

**`EstadoCita` es configuración, no datos de referencia.** Sus indicadores deciden qué se
puede hacer con una cita, así que cambiar una fila cambia el comportamiento del sistema
sin desplegar código. Tratar la tabla como se trata un archivo de configuración: se versiona
en la semilla y se revisa igual que el código.

**Los importes de `Cita` son copias congeladas.** `precioServicio`, `costoAdicionales` y
`costoTotal` guardan lo que valía el servicio el día de la reserva, para que subir un precio
no reescriba el historial. Los calcula el servidor; ver `02`.

**Las horas del día son minutos desde medianoche** (`0..1439`) en `HorarioAtencion`. Evita
la ambigüedad de zona horaria de `TIME` y hace trivial la aritmética de traslape. Los
instantes absolutos (`Cita.inicio/fin`, `RestriccionHorario.inicio/fin`) sí son `DateTime`.

**`RestriccionHorario.empleadoId` nulo significa "todo el negocio".** No hay una tabla
aparte para feriados generales.

**`Usuario` aparece dos veces en `Cita`:** `clienteId` y `registradaPorId`. Permite que el
personal reserve a nombre de un cliente sin perder quién digitó. Cuando el cliente reserva
solo, los dos son iguales.

## Desviaciones deliberadas respecto de la documentación previa

El doc 03 del Drive modela `Rol`, `DiaSemana` y `TipoRestriccionHorario` como tablas de
catálogo. Aquí son enums de Prisma, por dos razones: son conjuntos cerrados que nadie
administra desde la interfaz, y `Rol` ya existe como enum de TypeScript en
`common/enums/role.enum.ts`, contra el que compara `RolesGuard`. Tenerlo además como
tabla obliga a mantener dos definiciones sincronizadas a mano para ganar nada.

`EstadoCita` **sí** sigue siendo tabla, porque sus indicadores son justamente lo que un
negocio querría ajustar.

`permiteCancelacion` se partió en `permiteCancelacionCliente` y `permiteCancelacionPersonal`.
Con un solo indicador aplicado a los tres roles, una cita Confirmada no la podía cancelar
nadie, ni el administrador — la deuda ESC-03 del sistema anterior. Se corrige en el modelo,
no en el código que lo consume.

## Semilla

La migración inicial deja la base vacía de datos operativos, pero el sistema no arranca sin
catálogos. La semilla debe crear:

- Las filas de `EstadoCita`: como mínimo `PENDIENTE`, `CONFIRMADA`, `COMPLETADA`,
  `CANCELADA`. `CANCELADA` y `COMPLETADA` llevan `bloqueaDisponibilidad = false` y
  `esFinal = true`.
- La fila 1 de `ConfiguracionNegocio` con valores neutros.
- Un usuario `ADMIN` inicial, cuya contraseña **no** puede estar escrita en el repositorio:
  se toma de una variable de entorno y el proceso falla si no está.

La semilla de datos de prueba es un archivo distinto y nunca corre contra producción.

## Valores de `EstadoCita` en la semilla

Los valores por defecto del esquema son conservadores a propósito
(`permiteCancelacionCliente = false`), así que la semilla **tiene que** declararlos fila por
fila. Sembrar con los defaults reintroduce exactamente la deuda ESC-03 que el modelo corrige:
ningún cliente podría cancelar nada.

| `codigo` | `bloqueaDisponibilidad` | `permiteEdicion` | `...CancelacionCliente` | `...CancelacionPersonal` | `esFinal` |
|---|---|---|---|---|---|
| `PENDIENTE` | sí | sí | **sí** | sí | no |
| `CONFIRMADA` | sí | sí | no | **sí** | no |
| `COMPLETADA` | no | no | no | no | sí |
| `CANCELADA` | no | no | no | no | sí |

La fila que importa es `CONFIRMADA`: bloquea el espacio y el cliente ya no la cancela solo,
pero el personal sí. Ese es el hueco que el sistema anterior no tenía cubierto.

La fila 1 de `ConfiguracionNegocio` incluye `moneda` y `locale`. Un valor equivocado ahí no
rompe nada pero se ve en cada precio de la primera pantalla, así que va en la semilla y no
se deja al default.
