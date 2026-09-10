#!/bin/sh
# Sonda /health y avisa cuando la app deja de responder, y otra vez cuando vuelve.
#
# Que cubre y que no: esto vive en el mismo VPS que la app, asi que si el VPS se apaga,
# el vigia se apaga con el y nadie avisa nada. Para eso hace falta un monitor externo
# apuntando al dominio (ver DEPLOY.md). Lo que si cubre, y barato, es la caida que el
# monitor externo tarda en notar o no distingue: la app muerta con el servidor arriba,
# WAHA en bucle de reinicio, la base que dejo de responder.
#
# El umbral existe porque un despliegue reinicia el contenedor: avisar al primer fallo
# seria avisar en cada actualizacion.
set -eu

URL="${VIGIA_URL:-http://app/health}"
INTERVALO="${VIGIA_INTERVALO_S:-60}"
UMBRAL="${VIGIA_UMBRAL:-3}"
ETIQUETA="${ALERTA_ETIQUETA:-citas}"

log() { echo "[vigia $(date '+%F %T')] $*"; }

alertar() {
  [ -n "${ALERTA_WEBHOOK_URL:-}" ] || { log "sin ALERTA_WEBHOOK_URL: $1"; return 0; }
  mensaje="[$ETIQUETA] $1"
  if [ "${ALERTA_FORMATO:-json}" = "texto" ]; then
    curl -fsS --max-time 10 -X POST -H 'Content-Type: text/plain' \
      --data "$mensaje" "$ALERTA_WEBHOOK_URL" >/dev/null 2>&1 || log "no se pudo avisar"
  else
    escapado=$(printf '%s' "$mensaje" | sed 's/\\/\\\\/g; s/"/\\"/g')
    curl -fsS --max-time 10 -X POST -H 'Content-Type: application/json' \
      --data "{\"content\":\"$escapado\",\"text\":\"$escapado\"}" \
      "$ALERTA_WEBHOOK_URL" >/dev/null 2>&1 || log "no se pudo avisar"
  fi
}

fallos=0
avisado=0
log "vigilando $URL cada ${INTERVALO}s · avisa tras $UMBRAL fallos seguidos"

while true; do
  if curl -fsS --max-time 10 "$URL" >/dev/null 2>&1; then
    if [ "$avisado" -eq 1 ]; then
      log "recuperada"
      alertar "la app volvio a responder en $URL"
      avisado=0
    fi
    fallos=0
  else
    fallos=$((fallos + 1))
    log "sin respuesta ($fallos/$UMBRAL)"
    if [ "$fallos" -ge "$UMBRAL" ] && [ "$avisado" -eq 0 ]; then
      alertar "la app no responde en $URL desde hace $((fallos * INTERVALO))s"
      # Se avisa una sola vez por caida: repetir cada minuto convierte la alerta en ruido
      # y la siguiente se ignora.
      avisado=1
    fi
  fi
  sleep "$INTERVALO"
done
