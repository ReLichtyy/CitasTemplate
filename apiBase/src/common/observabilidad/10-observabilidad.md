# 10 · Observabilidad

Qué se registra, con qué forma, y cómo se pasa de "no me deja reservar" a la línea exacta
del log. Cubre los dos lados: el API y lo que el navegador no puede contar solo.

## El problema que resuelve

Antes de esto, el backend solo escribía cuando algo era 500. Un 400 por un DTO mal armado,
un 401 por token vencido, un 409 de traslape: nada de eso dejaba rastro, y son la mayoría
de lo que el frontend provoca. Del lado del navegador era peor: un error de render
desmontaba el árbol y dejaba una página en blanco, sin mensaje y sin registro en ningún
lado. En una demo eso es el fallo más caro, porque no deja nada que mirar.

## Decisión: tres piezas, un solo hilo

**El hilo es `x-request-id`.** Un middleware (`request-id.middleware.ts`) le pone un id a
cada petición, lo devuelve en la cabecera y lo publica en el contexto async
(`contexto-peticion.ts`, `AsyncLocalStorage`). Todo log que salga mientras se atiende esa
petición lo lleva, sin que ninguna firma del backend cargue con un parámetro extra.

Es **middleware y no interceptor** porque tiene que correr antes que los guards: el primer
log de una petición que `JwtAuthGuard` rechaza ya necesita el id.

El id entrante se **acepta pero no se cree**: se valida forma y largo (`^[A-Za-z0-9._-]{8,64}$`)
antes de reutilizarlo. Sin ese filtro el cliente elige qué cadena entra en el log del
servidor — un salto de línea ahí falsifica una línea entera.

**Un logger, dos formatos** (`logger.estructurado.ts`). `json` en producción: una línea por
evento, que es lo que `jq`, `grep` y journald pueden usar. `texto` fuera de producción: el
`ConsoleLogger` de Nest, porque leer JSON crudo mientras se desarrolla es peor. Se pasa en
`NestFactory.create({ logger })` y no con `app.useLogger()`, para que los logs del propio
arranque ya salgan con formato.

La serialización con `JSON.stringify` **es** la defensa contra inyección de logs: un `\n`
dentro de un valor sale escapado y no puede fabricar una línea falsa. Importa porque parte
de lo que se registra viene del navegador. Todo campo lleva tope de largo, y el
serializador tolera ciclos y `BigInt`: un log nunca puede ser la causa de un fallo.

**Dos líneas por petición fallida, con trabajos distintos.** `AccesoInterceptor` escribe
*qué* pasó (`evento: 'peticion'` — método, ruta declarada, status, ms). `ExcepcionesFilter`
escribe *por qué* (`evento: 'excepcion'` — url concreta y el `message` que se le devolvió al
cliente). Las une el `requestId`.

- La ruta declarada (`/citas/:id`) agrupa; la url concreta solo aparece en el error, que es
  donde hace falta para reproducir.
- Nivel por status: 5xx → `error`, 4xx → `warn`, resto → `log`. `/health` en éxito va a
  `debug`: lo pregunta un monitor cada pocos segundos y a nivel `log` esconde lo que
  importa.

## Lo que NO se hizo, y por qué

- **No hay tabla.** Los eventos van al log del proceso, no a MariaDB. Una tabla de errores
  se llena justo cuando el sistema está mal, y compite por la misma base que atiende las
  reservas.
- **La aplicación no escribe archivos ni rota nada.** Escribe a stdout; rotar es del gestor
  de procesos (systemd, pm2, docker).
- **El sobre de respuesta no cambió.** Sigue siendo `{ success, data, message }` (04). El id
  viaja en la cabecera, que es donde va un dato de transporte. Un campo nuevo en el sobre
  habría sido una excepción al único contrato que no tiene excepciones.
- **Sin APM ni servicio externo.** Un despliegue por negocio y una demo: `grep` sobre el log
  del proceso alcanza, y no agrega una dependencia de red al camino de la petición.

## `POST /telemetria/errores`

Lo que el navegador reporta de sí mismo. `@Public()`, porque el caso que más importa es el
que no tiene sesión: la landing que revienta, o un invitado en `ReservarPage`.

Pública y que escribe ⇒ lleva `LimiteIntentosGuard` como las rutas de `auth`
(30 por IP cada 5 min — más alto que el del login, porque perder un reporte legítimo es
peor que registrar uno de más). Responde 204: no hay nada que contestarle a un reporte.

`EventoClienteDto` trata todo el cuerpo como **dato no confiable**: `tipo` es un enum
cerrado (es la columna por la que se agrupa, y un valor libre no agruparía), cada campo
tiene tope de largo, y el `ValidationPipe` global rechaza cualquier campo de más.

**La `ruta` que se reporta es solo `pathname`, nunca `search`.** El query string de esta app
lleva el token de confirmación de cita: mandarlo aquí lo dejaría escrito en el log, que es
exactamente donde no debe estar un token válido.

El evento sale como `evento: 'cliente'` con dos ids distintos: el `requestId` de la petición
del reporte (lo pone el logger) y `requestIdOrigen`, el de la petición que falló.

## Frontend

- **`ErrorBoundary`** (`components/layout/`) envuelve router y contexto en `main.tsx` — más
  adentro se caería junto con lo que intenta atajar. Reporta con `tipo: 'render'` más la
  pila de componentes, y muestra el código que devolvió el servidor para que quien mira la
  demo pueda citarlo. Es el único componente de clase del frontend: React no expone
  `componentDidCatch` a los hooks.
- **`lib/telemetria.ts`** cubre lo que el boundary no ve: `window.onerror` y
  `unhandledrejection`. Usa `fetch` pelado a propósito — **es la única excepción** a "todo
  pasa por `services/`" (`Template/CLAUDE.md`). Pasar por `apiClient` haría que un reporte
  fallido cerrara la sesión (401) o disparara otro reporte.
- **Dos frenos contra el bucle**: dedupe por tipo+mensaje durante 60 s, y tope de 20
  reportes por carga de página. El caso real es un error dentro de un `useEffect` que
  reintenta el render; sin freno son cientos de peticiones por segundo contra el mismo API
  que se está diagnosticando. El límite por IP del backend es la red de abajo.
- **`api/client.ts`**: `ApiError` ahora lleva `requestId`. Un `fetch` que no llega a
  contestar deja de salir como `"Failed to fetch"` y pasa a ser un `ApiError` con status
  `SIN_RESPUESTA` (0) y texto en español — es la única falla que el servidor no puede
  registrar, porque no se enteró. Solo el 5xx se reporta: el 4xx ya quedó en el log del
  servidor con el mismo id, y reportarlo sería contarlo dos veces.

El navegador solo puede leer `x-request-id` porque el API lo publica con `exposedHeaders`
(`main.ts`). En una petición de otro origen las demás cabeceras están ocultas.

## Cómo se usa

```bash
# Todo lo que pasó en una petición, los dos lados incluidos
grep 'ID-QUE-MOSTRO-LA-PANTALLA' api.log | jq

# Qué está fallando ahora mismo
jq -c 'select(.nivel=="error" or .nivel=="warn")' api.log

# Lo que reportaron los navegadores
jq -c 'select(.evento=="cliente")' api.log

# Rutas más lentas
jq -c 'select(.evento=="peticion") | [.ms,.metodo,.ruta]' api.log | sort -rn | head
```

## Pendiente

- `GET /health` sigue sin tocar la base: responde `ok` con MariaDB caída.
- El log del worker de notificaciones no tiene `requestId` — no nace de una petición. Si
  hace falta seguir un aviso de punta a punta, el id que corresponde es el de la cita.
