# 04 · Contrato HTTP

Corto a propósito. Su valor es que no tenga excepciones.

## Sobre de respuesta

Toda respuesta del API tiene la misma forma:

```json
{ "success": true,  "data": { }, "message": null }
{ "success": false, "data": null, "message": "El horario ya está tomado" }
```

Lo arma un interceptor global en caso de éxito y un filtro de excepciones en caso de error.
**Ningún controlador construye su propio formato.** Las listas van en `data` como arreglo;
si algún día llevan paginación, va dentro de `data`, no como hermano del sobre.

## Errores

Los errores se **lanzan**, no se devuelven. Un servicio que detecta un traslape lanza una
excepción de Nest; nunca retorna un objeto de error. El filtro global la traduce.

| Situación | Código | `message` |
|---|---|---|
| DTO inválido | 400 | El primero de `class-validator`, en español |
| Sin token o token vencido | 401 | Genérico |
| Rol o propiedad insuficiente | 403 | Genérico, sin revelar si el recurso existe |
| Id inexistente | 404 | Genérico |
| Traslape de horario, teléfono ya registrado | 409 | **Específico y accionable** |
| Cualquier otra | 500 | Genérico. El detalle va al log, nunca al cliente |

El 409 es el único que se redacta pensando en que el usuario final lo va a leer tal cual.
Es el que justifica todo este contrato: sin él, `ReservarPage` no puede explicar por qué
falló una reserva.

Nunca se filtran al cliente: stack traces, mensajes de Prisma, nombres de columna, ni
`Usuario.password` — que no debe salir de la capa de servicios en ninguna respuesta.

## Frontend

`api/client.ts` hoy hace `throw new Error('API error 409: Conflict')` y **descarta el cuerpo**.
Con este contrato, lee el sobre y lanza un error que conserva `message` y el código, para que
las páginas muestren el texto del API en vez de una cadena inventada. Es el cambio que hace
que el punto anterior sirva de algo.

## Nombres

Rutas en plural y en español, consistentes con los módulos: `/citas`, `/servicios`,
`/empleados`, `/horarios`, `/restricciones`, `/adicionales`. Los campos del JSON usan los
mismos nombres que el modelo de datos — sin traducir ni renombrar entre capas.
