#!/bin/sh
# Lo que tiene que pasar antes de que el primer proceso escuche, y en este orden:
#
#   1. Validar la configuracion. Un secreto faltante que se descubre en la primera
#      peticion es una caida en produccion; aca es un contenedor que no arranca.
#   2. Derivar de APP_URL lo que el API espera en tres variables distintas.
#   3. Migrar la base. Tambien es la espera a que MariaDB este arriba: reintentar la
#      migracion sirve para las dos cosas y no necesita un cliente de mysql en la imagen.
#   4. Sembrar el catalogo. Sin la tabla EstadoCita el API arranca pero no agenda nada.
#
# Recien despues se le pasa el control a supervisor (CMD).
set -eu

API_DIR=/srv/citas/api
log() { echo "[entrypoint] $*"; }
fatal() { echo "[entrypoint] ERROR: $*" >&2; exit 1; }

# --- 1 - Configuracion obligatoria ------------------------------------------
[ -n "${DATABASE_URL:-}" ] || fatal "Falta DATABASE_URL. Ver DEPLOY.md."
[ -n "${JWT_SECRET:-}" ]   || fatal "Falta JWT_SECRET. Generelo con: openssl rand -hex 32"

# El API tambien lo valida y se niega a arrancar, pero ahi el mensaje sale enterrado en
# un stack trace de Nest.
if [ "$(printf %s "$JWT_SECRET" | wc -c)" -lt 32 ]; then
  fatal "JWT_SECRET tiene menos de 32 caracteres."
fi

# --- 2 - Derivados de APP_URL ------------------------------------------------
# APP_URL es la URL publica del sitio. El API la necesita con dos nombres y por dos
# razones distintas (origen permitido por CORS, y base del enlace de confirmacion que
# viaja por WhatsApp), pero en este despliegue las dos son la misma: el frontend y el
# API salen por el mismo nginx.
if [ -n "${APP_URL:-}" ]; then
  CORS_ORIGIN="${CORS_ORIGIN:-$APP_URL}"
  FRONTEND_URL="${FRONTEND_URL:-$APP_URL}"
  export CORS_ORIGIN FRONTEND_URL
fi
[ -n "${CORS_ORIGIN:-}" ] || fatal "Falta APP_URL (o CORS_ORIGIN). Ver DEPLOY.md."

# Detras de un proxy de arriba (Traefik de Dokploy, o nginx del VPS) hay dos saltos
# hasta el API: el de afuera y el de este contenedor. Sin esto, `request.ip` es
# 127.0.0.1 para todo el mundo y el limite de intentos de login cuenta el trafico junto.
export TRUST_PROXY="${TRUST_PROXY:-2}"

# Con WAHA apagado, el API no debe ver WAHA_URL: eso es justo lo que lo hace elegir el
# gateway que escribe al log, y sin ese vaciado apuntaria a un puerto muerto.
if [ "${WAHA_AUTOSTART:-true}" != "true" ]; then
  unset WAHA_URL || true
  export WAHA_URL=""
  log "WAHA_AUTOSTART=false: los avisos se escriben al log, no salen por WhatsApp"
elif [ -z "${WAHA_API_KEY:-}" ]; then
  fatal "WAHA esta encendido pero falta WAHA_API_KEY (el texto plano, no el hash)."
fi

log "zona horaria: ${TZ:-UTC} · hora local: $(date)"

# --- 3 - Migraciones ---------------------------------------------------------
# El reintento cubre el arranque en frio del VPS, donde el contenedor de la app suele
# ganarle a MariaDB aunque compose declare la dependencia.
if [ "${EJECUTAR_MIGRACIONES:-true}" = "true" ]; then
  intentos=0
  maximo="${MIGRACIONES_MAX_INTENTOS:-30}"
  until (cd "$API_DIR" && node_modules/.bin/prisma migrate deploy --config prisma7.config.ts); do
    intentos=$((intentos + 1))
    [ "$intentos" -lt "$maximo" ] || fatal "La base no respondio tras $maximo intentos."
    log "base no disponible o migracion fallida (intento $intentos/$maximo); reintento en 2 s"
    sleep 2
  done
  log "migraciones al dia"
else
  log "EJECUTAR_MIGRACIONES=false: no se toca el esquema"
fi

# --- 4 - Semilla del catalogo ------------------------------------------------
# Es idempotente (upsert con ids fijos), asi que correrla en cada arranque no duplica
# nada y repara un catalogo tocado a mano. Trae ademas servicios y personal de ejemplo:
# son datos, se borran cuando el negocio carga los suyos. SEED_PASSWORD vacia (lo unico
# admisible aqui) los deja sin contrasena y el login los rechaza.
if [ "${EJECUTAR_SEED:-true}" = "true" ]; then
  (cd "$API_DIR" && node_modules/.bin/tsx prisma/seed.ts) || fatal "La semilla fallo."
  log "catalogo sembrado"
fi

log "arrancando nginx + API + WAHA"
exec "$@"
