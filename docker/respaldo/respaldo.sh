#!/bin/sh
# Dump periodico de MariaDB, verificado y con retencion.
#
# Verificado es la palabra que importa: un `mysqldump` que se corta a la mitad sale con
# codigo 0 mas seguido de lo que parece (disco lleno, conexion perdida, OOM del server),
# y el archivo truncado se ve igual de bien en un `ls`. Aca se comprueban las dos cosas
# que un dump completo siempre cumple: que el gzip cierra, y que la ultima linea es la
# marca de fin que escribe mariadb-dump.
set -eu

DB="${MARIADB_DATABASE:-citas_template}"
DESTINO=/respaldos
INTERVALO="${RESPALDO_INTERVALO_S:-86400}"
RETENCION="${RESPALDO_RETENCION_DIAS:-14}"
ESPERA_INICIAL="${RESPALDO_ESPERA_INICIAL_S:-120}"
ETIQUETA="${ALERTA_ETIQUETA:-citas}"

log() { echo "[respaldo $(date '+%F %T')] $*"; }

# Aviso al webhook, si hay uno. Nunca tumba el bucle: que no se pueda avisar de un fallo
# no es razon para dejar de respaldar.
alertar() {
  [ -n "${ALERTA_WEBHOOK_URL:-}" ] || return 0
  mensaje="[$ETIQUETA] $1"
  if [ "${ALERTA_FORMATO:-json}" = "texto" ]; then
    curl -fsS --max-time 10 -X POST -H 'Content-Type: text/plain' \
      --data "$mensaje" "$ALERTA_WEBHOOK_URL" >/dev/null 2>&1 || log "no se pudo avisar"
  else
    # `content` lo lee Discord, `text` lo lee Slack. Mandar los dos evita una variable
    # mas solo para decir cual de los dos servicios es.
    escapado=$(printf '%s' "$mensaje" | sed 's/\\/\\\\/g; s/"/\\"/g')
    curl -fsS --max-time 10 -X POST -H 'Content-Type: application/json' \
      --data "{\"content\":\"$escapado\",\"text\":\"$escapado\"}" \
      "$ALERTA_WEBHOOK_URL" >/dev/null 2>&1 || log "no se pudo avisar"
  fi
}

respaldar() {
  marca=$(date +%Y-%m-%d-%H%M)
  final="$DESTINO/citas-$marca.sql.gz"
  parcial="$final.parcial"

  # --single-transaction: dump consistente sin bloquear las reservas que entren
  #   mientras corre (InnoDB, que es lo que usa todo el esquema).
  # --routines --events: lo que no es una tabla tambien se pierde si no se pide.
  if ! mariadb-dump \
        --host=db --user=root --password="$MARIADB_ROOT_PASSWORD" \
        --single-transaction --quick --routines --events \
        --default-character-set=utf8mb4 \
        "$DB" | gzip -9 > "$parcial"; then
    rm -f "$parcial"
    return 1
  fi

  gzip -t "$parcial" || { rm -f "$parcial"; return 1; }
  gzip -dc "$parcial" | tail -c 200 | grep -q 'Dump completed' || { rm -f "$parcial"; return 1; }

  # El rename es lo ultimo: mientras el archivo se llama .parcial, nadie lo confunde con
  # un respaldo bueno, y un contenedor que muere a mitad no deja uno falso.
  mv "$parcial" "$final"
  log "listo: $(basename "$final") ($(du -h "$final" | cut -f1))"
}

mkdir -p "$DESTINO"
log "cada ${INTERVALO}s · retencion ${RETENCION} dias · destino $DESTINO"

# La app arranca migrando; respaldar en ese momento no aporta y compite por la base.
sleep "$ESPERA_INICIAL"

while true; do
  if respaldar; then
    # La purga va DESPUES de un respaldo bueno. Al reves, una racha de fallos borraria
    # los respaldos viejos sin haber escrito uno nuevo.
    borrados=$(find "$DESTINO" -name 'citas-*.sql.gz' -type f -mtime "+$RETENCION" -print -delete | wc -l | tr -d ' ')
    # Con `set -e`, un `[ ... ] && log` que da falso termina el script: el estado de la
    # lista es 1 y el bucle se muere en silencio la primera vez que no hay nada que purgar.
    if [ "$borrados" -gt 0 ]; then
      log "purgados $borrados respaldos de mas de $RETENCION dias"
    fi
    find "$DESTINO" -name '*.parcial' -type f -mmin +120 -delete 2>/dev/null || true
  else
    log "FALLO el respaldo"
    alertar "el respaldo de la base fallo. Revisar: docker compose logs respaldo"
  fi
  sleep "$INTERVALO"
done
