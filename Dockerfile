# syntax=docker/dockerfile:1.7
#
# Imagen unica del proyecto: frontend + API + worker de notificaciones + WAHA.
#
# Por que todo en una imagen y no un servicio por contenedor:
#   - El worker es el mismo binario que el API y, corriendo en el mismo proceso, la
#     reserva despierta al worker al confirmar: el aviso sale sin esperar al sondeo
#     (ver apiBase/.env.example, NOTIFICACIONES_INTERVALO_MS).
#   - WAHA en el mismo contenedor deja el webhook y las llamadas del adaptador en
#     loopback (127.0.0.1), sin salto de red de Docker ni DNS interno.
#   - El frontend se sirve desde el mismo origen que el API (nginx los une), asi que
#     el navegador no hace ninguna peticion cruzada: no hay CORS ni preflight.
#
# Lo unico que queda fuera es MariaDB: una base de datos no comparte ciclo de vida con
# la app, y su volumen no se arriesga a un `docker rm` del contenedor de la app.
#
# Build:  docker build -t citas:latest .
# Ver compose.vps.yml y DEPLOY.md.

# Misma linea mayor que trae la imagen de WAHA (Node 24 en noweb-2026.8.2, y la capa de
# verificacion de abajo lo comprueba). Compilar con una mayor y ejecutar con otra es
# pedir una diferencia de ABI o de resolucion de modulos que no aparece hasta el VPS.
ARG NODE_IMAGE=node:24-bookworm-slim
# Misma linea que docker-compose.yml. Fijada a proposito: local y VPS iguales.
ARG WAHA_IMAGE=devlikeapro/waha:noweb-2026.8.2


# ---------------------------------------------------------------------------
# 1 - Dependencias del API (capa cacheada: solo cambia si cambia el lockfile)
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS api-deps
WORKDIR /src/apiBase
COPY apiBase/package.json apiBase/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund


# ---------------------------------------------------------------------------
# 2 - Build del API + poda a dependencias de produccion
# ---------------------------------------------------------------------------
FROM api-deps AS api-build
COPY apiBase/ ./

# `prisma generate` lee la URL desde prisma7.config.ts, que la toma del entorno. En
# build no hay base: cualquier cadena con forma valida sirve, no se conecta a nada.
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"

# El cliente se genera ANTES de compilar: el generador `prisma-client` emite TypeScript
# en src/generated/prisma, y es tsc quien lo lleva a dist/.
RUN npm run db:generate && npm run build

# El contenedor necesita la CLI de prisma (migrate deploy), tsx (semilla) y dotenv al
# arrancar, y las tres son devDependencies. Se captura la version EXACTA que dejo el
# lockfile ANTES de podar -una vez podadas, `require(...)` ya no las encuentra- y se
# reinstalan con --no-save despues de la poda, sin tocar package.json ni el lock.
#
# `npm pkg set dependencies.X=...` seguido de `npm install --omit=dev` NO alcanza: tsx es
# peer opcional de vite (que llega via vitest, devDependency), y npm deja su entrada en
# `dev:true` en el lockfile pase lo que pase con "dependencies" del manifest, asi que
# --omit=dev la poda igual. Verificado con node_modules/.bin/tsx ausente y el contenedor
# fallando en el arranque con "node_modules/.bin/tsx: not found".
RUN set -eux; \
    PRISMA_V="$(node -p "require('prisma/package.json').version")"; \
    TSX_V="$(node -p "require('tsx/package.json').version")"; \
    DOTENV_V="$(node -p "require('dotenv/package.json').version")"; \
    npm install --omit=dev --no-audit --no-fund; \
    npm install --no-save --no-audit --no-fund \
      "prisma@$PRISMA_V" "tsx@$TSX_V" "dotenv@$DOTENV_V"; \
    test -f dist/main.js


# ---------------------------------------------------------------------------
# 3 - Build del frontend
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS web-build
WORKDIR /src/Template
COPY Template/package.json Template/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY Template/ ./

# Ruta relativa a proposito: frontend y API salen por el mismo origen. Si algun
# despliegue los separa, se pasa --build-arg VITE_API_URL=https://api.ejemplo.com y ahi
# si hay que poner CORS_ORIGIN en el API.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build && test -f dist/index.html


# ---------------------------------------------------------------------------
# 4 - Imagen final: WAHA como base + API + frontend + nginx
# ---------------------------------------------------------------------------
# WAHA es la base, y no al reves, porque su imagen trae la sesion de WhatsApp montada
# tal como su autor la prueba (engine NOWEB, rutas, /app/.sessions). Copiar su codigo a
# otra base seria rehacer a mano algo que no controlamos.
FROM ${WAHA_IMAGE} AS runtime

# Explicito: si una version futura de WAHA cambiara a un usuario sin privilegios, la capa
# de paquetes de abajo fallaria sin decir por que.
USER root

# WAHA vive en /app. La app propia va a /srv/citas para no pisar nada de ahi.
WORKDIR /srv/citas

# nginx (estaticos + reverse proxy), supervisor (arranca y revive los tres procesos),
# curl (healthcheck) y tzdata (la agenda depende de la zona horaria).
# El if/else cubre las dos familias de base posibles sin adivinar cual usa WAHA.
RUN set -eux; \
    if command -v apt-get >/dev/null 2>&1; then \
      apt-get update; \
      apt-get install -y --no-install-recommends nginx supervisor curl tzdata; \
      rm -rf /var/lib/apt/lists/*; \
    elif command -v apk >/dev/null 2>&1; then \
      apk add --no-cache nginx supervisor curl tzdata; \
    else \
      echo "La imagen base de WAHA no trae apt ni apk; ajuste esta capa."; exit 1; \
    fi

# El API usa Prisma 7 y NestJS 12. Si una version futura de WAHA baja de Node 20, esto
# rompe el BUILD en vez de romper el arranque en el VPS.
RUN set -eux; \
    node -v; \
    node -e "if (+process.versions.node.split('.')[0] < 20) { console.error('Node ' + process.versions.node + ' en la imagen de WAHA: el API necesita >= 20'); process.exit(1) }"

# El comando de arranque de WAHA se resuelve UNA vez, aqui, y se congela en un script.
#
# Lo que se ejecuta es el `/entrypoint.sh` de la propia imagen de WAHA, no `node dist/main`
# a secas, porque ese script hace dos cosas que WAHA da por hechas:
#   - Normaliza la clave: lee WHATSAPP_API_KEY (o WAHA_API_KEY), **desexporta las dos** y
#     deja WAHA_API_KEY con la forma `sha512:<hex>`, que es la unica que el proceso lee.
#     Saltarselo aqui era arrancar WAHA sin clave —su API entera sin autenticacion dentro
#     del contenedor— y ademas dejarle a la vista el WAHA_API_KEY en claro que este
#     contenedor tiene puesto para el API de citas. El desexportado es justamente lo que
#     evita lo segundo.
#   - Calcula UV_THREADPOOL_SIZE segun los nucleos de la maquina.
# El `dist/main` es la caida por si una version futura mueve o quita el entrypoint.
RUN <<'FIN' /bin/sh
set -eux
{
  echo '#!/bin/sh'
  echo 'set -e'
  echo 'cd /app'
  if [ -f /entrypoint.sh ]; then
    echo 'exec /bin/sh /entrypoint.sh'
  elif [ -f /app/dist/main.js ]; then
    echo 'exec node dist/main.js'
  elif [ -f /app/dist/main ]; then
    echo 'exec node dist/main'
  else
    echo "No se encontro el punto de entrada de WAHA en /app" >&2
    ls -la /app >&2
    exit 1
  fi
} > /usr/local/bin/waha-run
chmod +x /usr/local/bin/waha-run
cat /usr/local/bin/waha-run
FIN

# --- API ---------------------------------------------------------------------
# node_modules ya viene podado a produccion desde la etapa api-build.
COPY --from=api-build /src/apiBase/node_modules      /srv/citas/api/node_modules
COPY --from=api-build /src/apiBase/dist              /srv/citas/api/dist
COPY --from=api-build /src/apiBase/package.json      /srv/citas/api/package.json
COPY --from=api-build /src/apiBase/prisma7.config.ts /srv/citas/api/prisma7.config.ts
# Migraciones y semilla: el contenedor las corre al arrancar.
COPY --from=api-build /src/apiBase/prisma            /srv/citas/api/prisma
# La semilla importa el cliente generado desde src/, no desde dist/.
COPY --from=api-build /src/apiBase/src/generated     /srv/citas/api/src/generated

# --- Frontend estatico -------------------------------------------------------
COPY --from=web-build /src/Template/dist /srv/citas/web

# --- Configuracion de los procesos -------------------------------------------
COPY docker/nginx.conf       /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/supervisord.conf
COPY docker/entrypoint.sh    /usr/local/bin/entrypoint.sh
# El `sed` quita los CR: el repo se edita en Windows y un shebang seguido de \r deja el
# contenedor con "exec format error", que no dice nada sobre la causa real.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
 && chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /app/.sessions /var/log/supervisor /var/log/nginx /var/cache/nginx \
 && nginx -t

# Valores que describen la topologia DE ESTA IMAGEN y no cambian por despliegue. Lo que
# si cambia (secretos, dominio, base de datos) va en el .env del compose.
#
# HEAP_WAHA_MB y HEAP_API_MB son el techo de heap de cada Node, y los lee
# docker/supervisord.conf. Sin ellos los dos procesos heredan el
# NODE_OPTIONS=--max-old-space-size=16384 que trae la imagen de WAHA: con `mem_limit`
# de por medio, eso no es un limite alto sino un contenedor que muere por OOM antes de
# que ninguno de los dos se moleste en juntar basura.
ENV NODE_ENV=production \
    TZ=UTC \
    API_PORT=8080 \
    WAHA_PORT=3000 \
    HEAP_WAHA_MB=900 \
    HEAP_API_MB=320 \
    WAHA_URL=http://127.0.0.1:3000 \
    WAHA_SESSION=default \
    WAHA_AUTOSTART=true \
    NOTIFICACIONES_WORKER=true \
    EJECUTAR_MIGRACIONES=true \
    EJECUTAR_SEED=true

# Unico puerto publicado. WAHA (3000) y el API (8080) quedan dentro del contenedor: la
# API de WAHA expuesta es cualquiera mandando WhatsApp con el numero del negocio.
EXPOSE 80

# nginx responde /health con el JSON del API: cubre los dos procesos de un tiro.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS http://127.0.0.1/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf", "-n"]
