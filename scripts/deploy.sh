#!/usr/bin/env bash
# Despliegue a mano en el VPS. Es el camino de emergencia y el de un VPS sin Dokploy:
# lo normal es que despliegue Dokploy al recibir el webhook de GitHub Actions.
#
#   ./scripts/deploy.sh            baja la imagen publicada por CI y la levanta
#   ./scripts/deploy.sh --build    compila aqui mismo (sin CI, o para probar un cambio)
#   ./scripts/deploy.sh --sin-vuelta-atras   deja el contenedor roto en pie para mirarlo
#
# Lo que hace y no se ve: guarda el id de la imagen que estaba corriendo ANTES de tocar
# nada, y si la nueva no responde /health la vuelve a poner. Un despliegue que falla y
# deja el sitio caido hasta que alguien lo note es peor que uno que no se hizo.
set -euo pipefail

cd "$(dirname "$0")/.."

ARCHIVO_ENV=.env.vps
COMPOSE=(docker compose -f compose.vps.yml --env-file "$ARCHIVO_ENV")
COMPILAR=0
VUELTA_ATRAS=1
ESPERA_SALUD=${ESPERA_SALUD:-180}

for arg in "$@"; do
  case "$arg" in
    --build) COMPILAR=1 ;;
    --sin-vuelta-atras) VUELTA_ATRAS=0 ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

log() { echo "[deploy] $*"; }
fatal() { echo "[deploy] ERROR: $*" >&2; exit 1; }

[ -f "$ARCHIVO_ENV" ] || fatal "Falta $ARCHIVO_ENV. Copie docker/.env.vps.example."

# shellcheck disable=SC1090
set -a; . "./$ARCHIVO_ENV"; set +a
IMAGEN="${IMAGEN:-citas:latest}"
PUERTO_PUBLICO="${PUERTO_PUBLICO:-8080}"

# La crea Dokploy. En un VPS sin Dokploy no existe, y el compose la declara `external`.
if ! docker network inspect dokploy-network >/dev/null 2>&1; then
  log "creando dokploy-network (no existia)"
  docker network create dokploy-network >/dev/null
fi

# El id, no la etiqueta: `latest` va a apuntar a la imagen nueva en un momento, y volver
# atras por etiqueta seria volver a la misma imagen que fallo.
ANTERIOR=$(docker image inspect -f '{{.Id}}' "$IMAGEN" 2>/dev/null || echo "")
# Con `set -e`, un `[ ... ] && log` que da falso corta el script: sin imagen previa
# (primer despliegue) el estado de la lista es 1 y el despliegue moriria antes de empezar.
if [ -n "$ANTERIOR" ]; then log "imagen actual: ${ANTERIOR:0:19}"; fi

if [ "$COMPILAR" -eq 1 ]; then
  log "compilando la imagen aqui"
  "${COMPOSE[@]}" build app
else
  log "bajando $IMAGEN"
  "${COMPOSE[@]}" pull app || fatal "No se pudo bajar $IMAGEN. Con --build se compila aqui."
fi

log "levantando"
"${COMPOSE[@]}" up -d --remove-orphans

log "esperando /health (hasta ${ESPERA_SALUD}s)"
sano=0
for _ in $(seq 1 "$ESPERA_SALUD"); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${PUERTO_PUBLICO}/health" >/dev/null 2>&1; then
    sano=1; break
  fi
  sleep 1
done

if [ "$sano" -eq 1 ]; then
  log "arriba y respondiendo"
  # Las imagenes viejas se acumulan hasta llenar el disco del VPS, y un disco lleno tira
  # la base antes que a nadie.
  docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
  "${COMPOSE[@]}" ps
  exit 0
fi

log "/health no respondio"
"${COMPOSE[@]}" logs --tail 60 app || true

if [ "$VUELTA_ATRAS" -eq 1 ] && [ -n "$ANTERIOR" ]; then
  log "volviendo a la imagen anterior"
  docker tag "$ANTERIOR" "$IMAGEN"
  "${COMPOSE[@]}" up -d
  fatal "Despliegue revertido. La version anterior quedo corriendo."
fi

fatal "Despliegue fallido y sin vuelta atras (no habia imagen anterior, o se pidio --sin-vuelta-atras)."
