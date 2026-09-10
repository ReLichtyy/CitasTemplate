#!/usr/bin/env bash
# Restaura un respaldo sobre la base del VPS. Es destructivo: lo que hay ahora se pierde.
#
#   ./scripts/restaurar.sh respaldos/citas-2026-09-09-0300.sql.gz
#   ./scripts/restaurar.sh --listar
#
# El respaldo que nunca se restauro no es un respaldo, es una suposicion. Este script
# existe para que probarlo sea un comando y no una tarde.
#
# Antes de escribir nada toma un dump de seguridad de lo que hay: si el archivo que se
# restaura resulta estar mal, todavia queda de donde volver.
set -euo pipefail

cd "$(dirname "$0")/.."

ARCHIVO_ENV=.env.vps
COMPOSE=(docker compose -f compose.vps.yml --env-file "$ARCHIVO_ENV")

log() { echo "[restaurar] $*"; }
fatal() { echo "[restaurar] ERROR: $*" >&2; exit 1; }

[ -f "$ARCHIVO_ENV" ] || fatal "Falta $ARCHIVO_ENV."
# shellcheck disable=SC1090
set -a; . "./$ARCHIVO_ENV"; set +a
DB="${MARIADB_DATABASE:-citas_template}"
DIR_RESPALDOS="${RESPALDOS_DIR:-./respaldos}"

if [ "${1:-}" = "--listar" ] || [ $# -eq 0 ]; then
  log "respaldos en $DIR_RESPALDOS:"
  ls -lh "$DIR_RESPALDOS"/citas-*.sql.gz 2>/dev/null || log "(ninguno)"
  # `[ ... ] && { ... }` aca cortaria el script con `set -e` cuando SI hay argumento.
  if [ $# -eq 0 ]; then
    echo; echo "Uso: $0 <archivo.sql.gz>"; exit 2
  fi
  exit 0
fi

ARCHIVO="$1"
[ -f "$ARCHIVO" ] || fatal "No existe $ARCHIVO"

# Las mismas dos comprobaciones que hace el contenedor de respaldo al escribirlo. Se
# repiten aca porque el archivo pudo haber viajado (scp, disco externo) desde entonces.
log "verificando $ARCHIVO"
gzip -t "$ARCHIVO" || fatal "El gzip esta corrupto."
gzip -dc "$ARCHIVO" | tail -c 200 | grep -q 'Dump completed' || fatal "El dump esta truncado."

echo
echo "  Se va a BORRAR el contenido de '$DB' y reemplazarlo por:"
echo "    $ARCHIVO  ($(du -h "$ARCHIVO" | cut -f1), $(date -r "$ARCHIVO" '+%F %T'))"
echo
read -r -p "  Escriba RESTAURAR para continuar: " confirmacion
[ "$confirmacion" = "RESTAURAR" ] || fatal "Cancelado."

seguridad="$DIR_RESPALDOS/antes-de-restaurar-$(date +%Y-%m-%d-%H%M).sql.gz"
log "dump de seguridad en $seguridad"
mkdir -p "$DIR_RESPALDOS"
"${COMPOSE[@]}" exec -T db mariadb-dump \
  --user=root --password="$MARIADB_ROOT_PASSWORD" \
  --single-transaction --quick --routines --events "$DB" | gzip -9 > "$seguridad"
gzip -t "$seguridad" || fatal "El dump de seguridad salio corrupto. No se restaura nada."

# La app se para primero: restaurar por debajo de un API que esta escribiendo deja la
# base en un estado que no es ni el respaldo ni lo que habia.
log "parando la app"
"${COMPOSE[@]}" stop app respaldo vigia

log "restaurando"
gzip -dc "$ARCHIVO" | "${COMPOSE[@]}" exec -T db \
  mariadb --user=root --password="$MARIADB_ROOT_PASSWORD" "$DB"

log "levantando la app"
"${COMPOSE[@]}" start app respaldo vigia

# El arranque migra: si el respaldo es de un esquema viejo, `migrate deploy` lo pone al
# dia solo, y es justo aca donde hay que enterarse si no puede.
# /health/listo, que es la que consulta la base: despues de una restauracion, "el proceso
# vive" no dice nada — lo que hay que confirmar es que la base restaurada contesta.
log "esperando /health/listo"
for _ in $(seq 1 120); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${PUERTO_PUBLICO:-8080}/health/listo" >/dev/null 2>&1; then
    log "restaurado y respondiendo"
    exit 0
  fi
  sleep 1
done

fatal "La app no volvio. Logs: docker compose -f compose.vps.yml logs app · el dump de seguridad esta en $seguridad"
