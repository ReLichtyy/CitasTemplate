# Despliegue en VPS

Una imagen con todo el producto, y al lado lo que no comparte su ciclo de vida: la base,
el respaldo y el vigía.

```
VPS (Contabo) · Dokploy
├── Traefik (lo trae Dokploy)     ← dominio, TLS, redirección 80→443
└── compose.vps.yml
    ├── app        una imagen: nginx + API (worker adentro) + WAHA
    ├── db         MariaDB 11.4, sin puertos, volumen propio
    ├── respaldo   dump diario verificado, con retención
    └── vigia      sonda /health y avisa cuando deja de responder

GitHub Actions:  verificar → publicar imagen en GHCR → avisar a Dokploy
```

## Por qué una sola imagen

- **El worker viaja con el API.** Es el mismo binario y, en el mismo proceso, la reserva
  despierta al worker al confirmar: el WhatsApp sale de una vez en lugar de esperar el
  siguiente tic del sondeo (hasta 20 s con la configuración por defecto).
- **WAHA en loopback.** El adaptador le pega a `127.0.0.1:3000` y el webhook vuelve a
  `127.0.0.1:8080`. Sin red de Docker, sin DNS interno, sin `extra_hosts`.
- **Un solo origen.** nginx sirve el frontend y el API bajo el mismo dominio, así que
  ninguna petición del navegador es cruzada: no hay preflight en ninguna.

---

## 1 · Preparar el VPS

Dokploy trae Docker, Traefik y su panel:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Apuntar el DNS del dominio (registro `A`) a la IP del VPS **antes** de crear la
aplicación: Let's Encrypt valida por HTTP y sin DNS resuelto no emite el certificado.

Dejar abiertos solo `22`, `80` y `443`. Ni la base ni WAHA escuchan fuera de la red de
Docker, y esa es la mitad del modelo de seguridad de este despliegue.

## 2 · Crear la aplicación en Dokploy

Panel → **Create** → **Compose**.

| Campo | Valor |
|---|---|
| Provider | GitHub → `ReLichtyy/CitasTemplate`, rama `main` |
| Compose Path | `compose.vps.yml` |
| Environment | pegar el contenido de `docker/.env.vps.example` con los valores reales |

Las etiquetas de Traefik ya están en `compose.vps.yml`: el dominio sale de `DOMINIO` y el
certificado lo emite el resolver `letsencrypt` de Dokploy. No hace falta configurar
dominios en el panel, y si se configuran igual, gana el que Dokploy escriba último —
elegir uno de los dos, no los dos.

Secretos que hay que generar antes de pegar el entorno:

```bash
openssl rand -hex 32     # JWT_SECRET
openssl rand -hex 32     # WAHA_HOOK_HMAC_KEY
openssl rand -hex 24     # WAHA_API_KEY, MARIADB_PASSWORD, MARIADB_ROOT_PASSWORD
node -e "console.log('sha512:'+require('crypto').createHash('sha512').update('LA-CLAVE').digest('hex'))"
#   ↑ el hash de WAHA_API_KEY, para WAHA_API_KEY_HASH
```

## 3 · Conectar el despliegue automático

En Dokploy, la aplicación tiene una **URL de webhook de redeploy**. Copiarla y ponerla en
GitHub → Settings → Secrets and variables → Actions:

| Secreto | Para qué |
|---|---|
| `DOKPLOY_WEBHOOK_URL` | Actions le avisa a Dokploy cuando hay imagen nueva |

Con eso, cada push a `main` corre `.github/workflows/despliegue.yml`:

1. **verificar** — lint, pruebas y compilación de `apiBase` y `Template`. Un fallo aquí
   corta todo: nunca se publica una imagen que no compiló.
2. **imagen** — construye y publica `ghcr.io/relichtyy/citastemplate:latest` y `:<sha>`.
   Se compila en Actions y no en el VPS: compilar el frontend y el API en una máquina de
   2 GB mientras sirve al público es un despliegue lento y un pico de memoria sobre el
   servidor que tiene que seguir respondiendo.
3. **desplegar** — golpea el webhook y Dokploy baja la imagen y recrea el contenedor.

El paquete de GHCR es privado por defecto. O se hace público, o el VPS necesita entrar
una vez:

```bash
echo "<TOKEN_CON_read:packages>" | docker login ghcr.io -u <usuario> --password-stdin
```

Si no hay `DOKPLOY_WEBHOOK_URL`, el flujo publica la imagen igual y lo dice en el log:
desplegar es entonces un `bash scripts/deploy.sh` en el VPS. También sirve poner
`SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PUERTO` y `RUTA_VPS`, y Actions lo corre solo.

## 4 · Primer arranque

El contenedor, antes de que nada escuche: valida la configuración, espera a MariaDB
reintentando `prisma migrate deploy`, siembra el catálogo (idempotente) y recién ahí
levanta los tres procesos. Un secreto faltante es un contenedor que no arranca, no una
caída en la primera petición.

```bash
docker compose -f compose.vps.yml --env-file .env.vps logs -f app
curl -fsS https://citas.ejemplo.com/health
```

## 5 · Parear el número de WhatsApp

Una sola vez por despliegue, y otra vez solo si se pierde el volumen `waha-sessions`.
WAHA no está publicado, así que se entra desde el propio contenedor:

```bash
C="docker compose -f compose.vps.yml --env-file .env.vps exec app"
$C curl -s -H "X-Api-Key: $WAHA_API_KEY" -X POST http://127.0.0.1:3000/api/sessions/default/start
$C curl -s -H "X-Api-Key: $WAHA_API_KEY" http://127.0.0.1:3000/api/default/auth/qr --output /tmp/qr.png
docker compose -f compose.vps.yml --env-file .env.vps cp app:/tmp/qr.png ./qr.png
```

El número es dedicado y desechable: el riesgo de baneo cae sobre el que se escanee.
Detalles y el resto del flujo en `apiBase/src/notificaciones/09-conexion-whatsapp.md`.

Hasta tener el número, `WAHA_AUTOSTART=false` deja la app entera funcionando con los
avisos escritos al log.

---

## Despliegue a mano

Para un VPS sin Dokploy, o cuando el panel no está disponible:

```bash
bash scripts/deploy.sh            # baja la imagen que publicó CI y la levanta
bash scripts/deploy.sh --build    # compila en el VPS (sin CI)
```

Guarda el id de la imagen que estaba corriendo, espera a `/health` hasta 180 s y, si no
responde, **vuelve sola a la versión anterior**. Un despliegue que falla y deja el sitio
caído hasta que alguien lo note es peor que uno que no se hizo.

## Respaldos

El contenedor `respaldo` hace un dump diario a `./respaldos` en el disco del VPS
(`RESPALDO_INTERVALO_S`), guarda 14 días (`RESPALDO_RETENCION_DIAS`) y avisa al webhook si
falla.

Cada dump se verifica antes de darlo por bueno: que el gzip cierre, y que la última línea
sea la marca de fin de `mariadb-dump`. Un dump cortado a la mitad sale con código 0 más
seguido de lo que parece —disco lleno, conexión perdida, OOM— y en un `ls` se ve igual de
bien que uno completo. Mientras se escribe se llama `.parcial`, así que un contenedor que
muere a mitad no deja un respaldo falso. Y la purga de los viejos corre **después** de un
dump bueno: al revés, una racha de fallos borraría los respaldos sin haber escrito uno
nuevo.

Restaurar:

```bash
bash scripts/restaurar.sh --listar
bash scripts/restaurar.sh respaldos/citas-2026-09-09-0300.sql.gz
```

Verifica el archivo, pide escribir `RESTAURAR`, toma un dump de seguridad de lo que hay
ahora, para la app, restaura y espera a que `/health` vuelva. **Probarlo una vez ahora,
no el día que haga falta**: un respaldo que nunca se restauró es una suposición.

Lo que este esquema no cubre: los respaldos viven en el mismo servidor que la base, así
que no sirven para el caso que más duele, que es perder el servidor. Copiarlos afuera es
un `rsync` en cron y hace falta:

```bash
# en otra máquina, diario
rsync -az --delete vps:/ruta/citas/respaldos/ ~/respaldos-citas/
```

## Monitoreo

Dos capas, y hacen falta las dos:

1. **Dentro** — el contenedor `vigia` sonda `/health` cada 60 s y avisa a
   `ALERTA_WEBHOOK_URL` tras 3 fallos seguidos, y otra vez cuando vuelve. El umbral existe
   porque un despliegue reinicia el contenedor: avisar al primer fallo sería avisar en
   cada actualización. Sirve cualquier webhook que acepte un POST (Discord, Slack, ntfy,
   Telegram); `ALERTA_FORMATO=texto` manda el mensaje pelado para ntfy.
2. **Fuera** — un monitor externo apuntando a `https://<dominio>/health`. Es
   imprescindible: el vigía vive en el mismo VPS, así que si el VPS se apaga se apaga con
   él y nadie avisa nada. Un plan gratuito de UptimeRobot o BetterStack alcanza.

Además, el `HEALTHCHECK` de la imagen más `restart: unless-stopped` hacen que un proceso
muerto se levante solo, y supervisor revive cualquiera de los tres sin tocar a los otros.

---

## Lo que hace rápida a esta imagen

| Decisión | Efecto |
|---|---|
| nginx sirve los estáticos | el bundle no pasa por Node |
| `/assets/` con `immutable` a un año | Vite ya pone el hash en el nombre; el navegador no revalida |
| `index.html` con `no-cache` | tras un despliegue el navegador pide los bundles nuevos, no los borrados |
| keepalive hacia el API | sin socket nuevo por petición |
| gzip sobre JSON y JS | menos bytes en el único salto que no es local |
| mismo origen | cero preflight: cada llamada del navegador es una sola ida y vuelta |
| worker en proceso | el aviso sale al confirmar, sin esperar el sondeo |
| WAHA en loopback | el webhook no cruza red |
| la imagen se compila en CI | el VPS solo baja capas; no compila mientras sirve |

## Detalles que conviene saber

- **`prisma migrate deploy` corre en cada arranque.** Es lo que hace que actualizar sea
  un push. Si prefiere migrar a mano, `EJECUTAR_MIGRACIONES=false`.
- **La semilla también.** Es idempotente y trae, además del catálogo de estados —sin él
  no se puede agendar nada—, servicios y personal de ejemplo. Son datos: se borran desde
  la app. Para no sembrar, `EJECUTAR_SEED=false`, pero entonces la tabla `EstadoCita` hay
  que llenarla por otro lado.
- **`TRUST_PROXY=2`** cuenta dos saltos (Traefik y el nginx del contenedor). Con un valor
  mal puesto, el límite de intentos de login cuenta todo el tráfico como si viniera de
  una sola IP.
- **`TZ`.** La agenda se lee en horas locales. Dejar `UTC` en un negocio que no está en
  UTC corre todas las citas.
- **`DOMINIO` va sin esquema** y `APP_URL` con él. Traefik quiere el nombre pelado en la
  regla `Host()`; el API quiere el origen completo. Meter el esquema en la regla la deja
  sin coincidir con nada y el sitio responde 404 de Traefik.
- **Escalar.** Esta imagen es de una instancia: WAHA maneja una sesión y no se replica.
  Si algún día hace falta más de un API, se saca WAHA a su propio servicio y el worker a
  su propio contenedor (`NOTIFICACIONES_WORKER`); el reclamo del outbox ya es atómico
  (`FOR UPDATE SKIP LOCKED`), así que el código no cambia.

## Si algo falla

```bash
C="docker compose -f compose.vps.yml --env-file .env.vps"
$C ps
$C logs --tail 100 app
$C exec app supervisorctl -c /etc/supervisor/supervisord.conf status
```

| Síntoma | Casi siempre es |
|---|---|
| El contenedor no arranca y el log dice `[entrypoint] ERROR:` | falta una variable |
| `502` en `/api/...` | el API no está arriba; los logs salen mezclados en `docker logs` |
| 404 de Traefik en el dominio | `DOMINIO` con esquema, o el contenedor fuera de `dokploy-network` |
| Certificado que no se emite | el DNS todavía no resuelve a la IP del VPS |
| WAHA en bucle de reinicio | el volumen de sesión: pararlo, borrar `waha-sessions` y volver a parear |
| El disco se llena | imágenes viejas (`docker image prune -a`) o respaldos sin purgar |
