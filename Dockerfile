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

ARG NODE_IMAGE=node:22-bookworm-slim
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

# El contenedor necesita la CLI de prisma (migrate deploy) y tsx (semilla) al arrancar,
# y las dos son devDependencies. Se promueven con la version EXACTA que dejo instalada
# el lockfile, y recien entonces se podan las demas devDependencies. Sin la version
# exacta, `npm install` podria subir de parche y la imagen dejaria de ser reproducible.
RUN set -eux; \
    npm pkg set \
      dependencies.prisma="$(node -p "require('prisma/package.json').version")" \
      dependencies.tsx="$(node -p "require('tsx/package.json').version")" \
      dependencies.dotenv="$(node -p "require('dotenv/package.json').version")"; \
    npm install --omit=dev --no-audit --no-fund; \
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
# Resolverlo en cada arranque seria repetir trabajo; hardcodearlo seria fijar un detalle
# interno de una imagen de terceros que cambia entre versiones.
RUN set -eux; \
    if [ -f /app/dist/main.js ]; then \
      printf '#!/bin/sh\nset -e\ncd /app\nexec node dist/main.js\n' > /usr/local/bin/waha-run; \
    elif [ -f /app/dist/main ]; then \
      printf '#!/bin/sh\nset -e\ncd /app\nexec node dist/main\n' > /usr/local/bin/waha-run; \
    elif [ -f /app/package.json ] && node -e "process.exit(require('/app/package.json').scripts && require('/app/package.json').scripts.start ? 0 : 1)"; then \
      printf '#!/bin/sh\nset -e\ncd /app\nexec npm run --silent start\n' > /usr/local/bin/waha-run; \
    else \
      echo "No se encontro el punto de entrada de WAHA en /app"; ls -la /app; exit 1; \
    fi; \
    chmod +x /usr/local/bin/waha-run; \
    cat /usr/local/bin/waha-run

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
ENV NODE_ENV=production \
    TZ=UTC \
    API_PORT=8080 \
    WAHA_PORT=3000 \
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
