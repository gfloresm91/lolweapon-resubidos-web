# Incidente 2026-08-21: colapso por concurrencia en Resubidos

## Resumen ejecutivo

El 21 de agosto de 2026, durante un directo y una entrada concentrada de usuarios a `resubidos.lolweapon.com`, la aplicación dejó de responder de forma sostenida. Nginx y PostgreSQL seguían activos, pero el único proceso Node de producción acumuló cientos de conexiones, consumió prácticamente un núcleo completo y dejó solicitudes HTTP esperando hasta agotar sus timeouts.

La causa raíz confirmada fue una amplificación de escrituras en PostgreSQL: cada consulta de notificaciones de un visitante invitado llamaba a `getPublicAccessUser()`, que ejecutaba `ensurePlatformPermissions()` y repetía la inicialización completa de roles, permisos y asignaciones mediante decenas de `upsert`. Al multiplicarse por cientos de navegadores y por el polling periódico, se produjo una tormenta de consultas y transacciones. Esto explica los `INSERT`, las sesiones `idle in transaction`, los errores Prisma `P2028` y el bloqueo del event loop observado durante el incidente.

El incidente se resolvió con el release `v2.22.1`, que hace esa inicialización una sola vez por proceso y comparte la promesa entre solicitudes concurrentes. El release también redujo consultas duplicadas, convirtió el polling de notificaciones en respaldo, agregó backoff con jitter a WebSocket, limpió sockets inactivos, deduplicó las solicitudes cliente de Twitch y agregó límites al pool PostgreSQL.

Como medida de capacidad, el Droplet pasó de 2 vCPU y 4 GiB de RAM a 4 vCPU y 8 GiB. El resize aportó margen, pero no fue la solución causal: antes del hotfix Node volvió a saturarse incluso en el servidor ampliado. Después del hotfix, con más de 860 conexiones HTTPS y aproximadamente 177 usuarios activos deduplicados, Node bajó de cerca de 97 % a 23–32 % de un núcleo y la latencia pública quedó mayoritariamente entre 0,36 y 0,53 segundos.

## Clasificación e impacto

- **Fecha:** 21 de agosto de 2026.
- **Ventana aproximada:** 16:00–18:25 CLT (`20:00–22:25 UTC`).
- **Servicio afectado:** `resubidos.service`, servido públicamente por Nginx.
- **Dominios relacionados:** principalmente `resubidos.lolweapon.com`; el mismo proceso también sirve funcionalidades compartidas con `viendo.lolweapon.com`.
- **Severidad operativa:** alta; indisponibilidad y timeouts durante un directo.
- **Datos:** no se observó pérdida ni corrupción de datos.
- **Seguridad:** no se encontró evidencia de ataque. Las conexiones se trataron como audiencia legítima; no se bloquearon IP ni usuarios.

## Síntomas observados

### Para usuarios

- La web no cargaba o quedaba esperando indefinidamente.
- Las solicitudes terminaban por timeout.
- La degradación reaparecía poco después de reiniciar producción cuando se restablecía el tráfico público.
- QA respondía normalmente mientras producción quedaba bloqueada.

### En el servidor

- `resubidos.service` permanecía `active`, pero no atendía solicitudes dentro del timeout.
- El proceso `node server.mjs` consumía aproximadamente 95–105 % según `ps`, equivalente a casi un núcleo completo de Linux, no al 100 % agregado del Droplet.
- La memoria RSS de Node creció aproximadamente desde 700–900 MiB hasta 1,4 GiB durante los intentos iniciales.
- El Droplet original utilizó swap y tuvo poco margen de memoria libre.
- Se acumularon cientos de conexiones establecidas hacia el puerto interno de Node.
- PostgreSQL mostró múltiples sesiones `idle in transaction`, además de actividad repetida de `INSERT` y `PARSE`.
- Prisma registró `P2028 Transaction API error: Unable to start a transaction in given time`.

## Estimación de usuarios simultáneos

No se debe interpretar el número de conexiones TCP como número de personas: cada navegador mantiene varias conexiones HTTP, WebSocket y API.

- Durante el colapso se observaron entre 434 y 868 conexiones HTTPS establecidas.
- Se observaron entre 288 y 500 conexiones establecidas hacia Node en el puerto de producción.
- El muestreo del access log mostró 360 accesos/conexiones a `/api/presence/ws`, pero pueden incluir reconexiones del mismo navegador.
- Después del hotfix, con un patrón de conexiones comparable, `/api/presence/ws` informó **177 usuarios activos deduplicados** en Inicio.

Con esa evidencia, la mejor estimación retrospectiva es de **aproximadamente 150–200 usuarios simultáneos reales** durante el pico. No existe evidencia que permita afirmar que las 800+ conexiones correspondían a 800 usuarios únicos.

## Capacidad antes y después

| Recurso | Antes | Después |
| --- | ---: | ---: |
| Plan | Basic Premium Intel, CPU compartida | Basic Premium Intel, CPU compartida |
| vCPU | 2 | 4 |
| RAM | 4 GiB | 8 GiB |
| Disco | 120 GB NVMe | 240 GB NVMe aproximados; 232 GB visibles por el sistema |
| Swap | 2 GiB, con uso durante el incidente | 2 GiB, prácticamente sin uso tras estabilización |
| Proceso web | Un proceso Node | Un proceso Node |
| PostgreSQL | Docker local | Docker local |

El aumento de disco fue permanente. Reducir el Droplet a un plan cuyo disco sea menor que el disco actual puede requerir migrar a un Droplet nuevo.

## Evidencia por componente

### `journalctl`

- El servidor registraba que estaba listo en el puerto de producción, por lo que el arranque de Next.js concluía.
- Los logs confirmaron el inicio de los jobs de notificaciones, YouTube y audiencia según sus flags.
- Antes del hotfix aparecieron errores Prisma `P2028` relacionados con imposibilidad de iniciar una transacción a tiempo.
- Después del release `v2.22.1`:
  - producción inició correctamente;
  - la sincronización de contenido informó `synced=22/22`;
  - no aparecieron errores, timeouts ni códigos Prisma en la ventana de verificación.

### Nginx

- Nginx se mantuvo activo y escuchando en HTTPS.
- Se observaron hasta 868 conexiones HTTPS establecidas.
- La configuración enviaba el tráfico de `resubidos.lolweapon.com` al proceso Node en el puerto de producción y reenviaba `Upgrade` para WebSocket.
- Al detener temporalmente Nginx desaparecieron las conexiones hacia Node y el backend volvió a responder.
- Al volver a iniciar Nginx, el volumen de conexiones reapareció y el proceso anterior volvió a degradarse, confirmando que el problema dependía del trabajo provocado por tráfico concurrente real.
- No se aplicaron bloqueos por IP, rate limits punitivos ni reglas para excluir usuarios.

### PostgreSQL

- El contenedor `lolweapon-resubidos-postgres` permaneció saludable.
- Reiniciar PostgreSQL no solucionó el problema, descartando conexiones antiguas como causa primaria.
- Antes del hotfix se observaron múltiples sesiones `idle in transaction`, consultas `INSERT` repetidas y fallos Prisma `P2028`.
- La revisión de código reveló que `ensurePlatformPermissions()` ejecutaba una inicialización completa desde `getPublicAccessUser()` por cada consulta invitada.
- Después del hotfix se observaron 12 conexiones `idle` normales, una conexión `active` correspondiente a la medición y **cero** sesiones `idle in transaction`.

### systemd y Docker

- `resubidos.service`, `nginx.service`, `docker.service` y SSH permanecieron activos salvo detenciones controladas durante el diagnóstico.
- `resubidos.service` se reinició varias veces para descartar estado residual.
- `resubidos-qa.service` se detuvo para liberar recursos, aunque despliegues posteriores pueden volver a iniciarlo explícitamente aun cuando haya sido deshabilitado.
- PostgreSQL se ejecutó como un único contenedor Docker saludable y expuesto solamente por loopback.

### Métricas y latencia

Antes del hotfix:

- Node: aproximadamente 95–105 % de un núcleo.
- RSS de Node: aproximadamente 700 MiB–1,4 GiB.
- Peticiones locales y públicas: timeouts de 12–20 segundos.
- Carga del host original: superior a la cantidad de vCPU en varios muestreos.

Después del hotfix `v2.22.1`:

- 861–866 conexiones HTTPS.
- 461–473 conexiones hacia Node.
- 177 usuarios activos deduplicados en Inicio.
- Node: aproximadamente 23–32 % de un núcleo.
- RSS de Node: aproximadamente 559–790 MiB y luego descendiendo.
- Cinco mediciones públicas consecutivas: `HTTP 200`, aproximadamente 0,36–1,08 segundos; la segunda muestra quedó entre 0,36 y 0,53 segundos.
- RAM disponible del host: aproximadamente 5,9–6,2 GiB.
- Sin errores recientes en `journalctl` y sin transacciones abiertas inactivas.

### Access log agregado

Una muestra agregada de 10.000 entradas, sin conservar IP, mostró:

| Ruta | Solicitudes observadas |
| --- | ---: |
| `/api/twitch/status` | 4.071 |
| `/api/notifications/ws` | 2.181 |
| `/api/notifications?limit=40` | 1.392 |
| `/inicio?stream=dual` | 665 |
| `/api/presence/ws` | 360 |
| `/` | 152 |
| `/api/youtube/videos` | 114 |

Estos conteos incluyen solicitudes repetidas y reconexiones; no representan usuarios únicos.

## Causa raíz confirmada

`GET /api/notifications` resolvía al usuario de acceso público mediante `getPublicAccessUser()`. Esa función llamaba siempre a `ensurePlatformPermissions()`. La inicialización recorría roles, permisos y asignaciones predeterminadas y ejecutaba múltiples operaciones de escritura idempotentes.

El centro de notificaciones consultaba la API al montar, cada 30 segundos, al recuperar foco y al recibir eventos WebSocket. Con cientos de navegadores invitados, la combinación convirtió una lectura frecuente en decenas de escrituras por solicitud. Las escrituras concurrentes saturaron el adaptador/pool PostgreSQL, dejaron transacciones esperando y consumieron el event loop del único proceso Node.

La causa se considera confirmada porque:

1. El access log mostró alta frecuencia en la API de notificaciones.
2. PostgreSQL mostró `INSERT` repetidos y `idle in transaction`.
3. El código conectaba directamente la lectura pública con la inicialización completa.
4. El resize por sí solo no resolvió la degradación.
5. Tras ejecutar la inicialización una sola vez por proceso y reducir las lecturas, desaparecieron las transacciones abiertas y Node bajó de ~97 % a ~30 % bajo una cantidad de conexiones igual o mayor.

## Causas contribuyentes

- Polling del centro de notificaciones cada 30 segundos aun con WebSocket conectado.
- Reconexión del WebSocket de notificaciones cada 5 segundos, sin backoff ni jitter.
- Ausencia de heartbeat del servidor para retirar sockets que dejaron de responder.
- Dos consumidores React del estado Twitch en un mismo navegador, cada uno con su propio intervalo.
- Doble resolución de sesión en una misma petición de notificaciones.
- Dos lecturas de notificaciones casi equivalentes para lista y conteo de no leídas.
- Único proceso Node: el Droplet tenía CPU agregada disponible, pero el event loop ocupado no podía repartir automáticamente el trabajo entre núcleos.
- Droplet original con 2 vCPU/4 GiB y otros servicios compartiendo el host.
- Conexiones legítimas concentradas durante un directo.
- Falta de una prueba de carga previa con WebSockets, polling y usuarios invitados representativos.

## Hipótesis descartadas

- **Nginx caído:** seguía activo y aceptando conexiones.
- **PostgreSQL detenido o corrupto:** el contenedor estaba saludable; reiniciarlo no corrigió la degradación.
- **Sincronización de YouTube como causa raíz:** se desactivó y Node volvió a saturarse.
- **Analítica de audiencia como causa raíz:** se desactivó y Node volvió a saturarse.
- **Ataque o usuarios maliciosos:** no se encontró evidencia; se asumió tráfico legítimo y no se bloquearon clientes.
- **Falta de RAM como única causa:** ampliar a 8 GiB eliminó la presión de memoria, pero la aplicación volvió a degradarse antes del hotfix.

## Cronología aproximada

Horarios en Chile continental (`CLT`, UTC-4); se incluye UTC cuando existe evidencia directa del servidor.

| Hora aproximada | Acción / observación |
| --- | --- |
| 16:00 CLT | Se reporta que la web de Resubidos no carga. QA responde; producción expira. |
| 16:05–16:20 | Se confirma Nginx activo, producción en puerto interno y PostgreSQL saludable. Node consume cerca de un núcleo y aparecen `P2028` e `idle in transaction`. |
| 16:20 | Se reinicia `resubidos.service`; responde brevemente y vuelve a degradarse. |
| 16:23 CLT / 20:23 UTC | Se desactiva temporalmente la sincronización de YouTube y se reinicia producción. No resuelve. |
| 16:26 CLT / 20:26 UTC | Se desactiva temporalmente la analítica de audiencia y se reinicia producción. No resuelve. |
| 16:27–16:31 | Se identifican cientos de conexiones acumuladas hacia Node. Se detiene Nginx temporalmente para aislar tráfico. |
| 16:32 CLT / 20:32 UTC | Con Nginx detenido y Node reiniciado, producción responde localmente en aproximadamente 1,1–1,6 segundos y usa muchos menos recursos. |
| 16:33–16:38 | Se vuelve a iniciar Nginx. Las conexiones crecen rápidamente y el proceso vuelve a saturarse, demostrando relación con el trabajo por solicitud. |
| 17:30 CLT / 21:30 UTC | Se completa el resize del Droplet a 4 vCPU y 8 GiB. Todos los servicios arrancan por reboot. |
| 17:31–17:38 | La web vuelve a responder, pero Node sube de nuevo hasta ~97 % de un núcleo con 868 conexiones HTTPS; el hardware solo no resuelve. |
| 17:40–17:58 | Se analiza el patrón de rutas y el código de notificaciones, Twitch, WebSocket y Prisma. Se confirma la inicialización repetida de permisos por invitado. |
| 17:59 CLT | Se crean los commits del hotfix y bump de versión. |
| 18:14 CLT | Se agrega la notificación deduplicada de `v2.22.1` y se crea el tag. |
| 18:16 CLT | Se integra `dev` en `main`; comienza el despliegue productivo. |
| 18:18 CLT / 22:18 UTC | `resubidos.service` inicia `v2.22.1`; sincronización de contenido `22/22`. |
| 18:19–18:25 | Verificación bajo 861–866 conexiones HTTPS: HTTP 200, latencia estable, Node ~23–32 %, cero `idle in transaction`. Incidente estabilizado. |

## Cambios aplicados

### Código

- `lib/repositories/platformUserRepository.js`
  - `ensurePlatformPermissions()` se ejecuta una vez por proceso.
  - Las solicitudes concurrentes comparten una única promesa de inicialización.
- `lib/repositories/notificationRepository.js`
  - Lista y conteo de no leídas se obtienen desde una sola lectura de notificaciones visibles.
- `app/api/notifications/route.js`
  - La sesión se resuelve una sola vez por petición.
- `components/NotificationCenter.js`
  - El polling queda como fallback cuando WebSocket no está conectado.
  - La cadencia de fallback aumenta.
  - Reconexión exponencial con jitter.
  - Se evita abrir un socket nuevo mientras otro está `OPEN` o `CONNECTING`.
- `lib/notificationRealtime.js`
  - Ping periódico y terminación de conexiones que no responden.
- `lib/clientTwitchStatus.js`
  - Caché breve compartida por navegador y una sola promesa en vuelo.
- `components/HomeDashboard.js` y `components/PersistentTwitchPlayer.js`
  - Ambos consumidores reutilizan la consulta Twitch compartida.
- `lib/prisma.js`
  - Límites explícitos de pool, conexión, consulta, sentencia, inactividad y transacción inactiva.
- `lib/newsGuideContent.js`
  - Novedad y changelog de `v2.22.1`.
- `lib/contentNotificationSync.js`
  - Notificación deduplicada `release:v2.22.1`.
- `docs/project-overview.md` y `.env.example`
  - Documentación del nuevo comportamiento y configuración.

### Variables de entorno

Se documentaron los siguientes nombres; los valores numéricos se resuelven mediante defaults del código y no se reproducen aquí:

- `DATABASE_POOL_MAX`
- `DATABASE_CONNECTION_TIMEOUT_MS`
- `DATABASE_IDLE_TIMEOUT_MS`
- `DATABASE_STATEMENT_TIMEOUT_MS`
- `DATABASE_QUERY_TIMEOUT_MS`
- `DATABASE_IDLE_TRANSACTION_TIMEOUT_MS`

Flags utilizados durante la mitigación:

- `YOUTUBE_NOTIFICATION_SYNC_ENABLED=false`
- `STREAM_AUDIENCE_ANALYTICS_ENABLED=false`

No se registran valores de `DATABASE_URL`, credenciales OAuth, secretos de webhook, tokens ni contraseñas.

### Infraestructura

- Resize del Droplet de 2 vCPU/4 GiB a 4 vCPU/8 GiB.
- Disco ampliado de 120 GB a aproximadamente 240 GB NVMe.
- Reinicios controlados de PostgreSQL y `resubidos.service` durante diagnóstico.
- Detención temporal de Nginx para aislar el backend del tráfico público.

### Servicios detenidos o deshabilitados durante el incidente

Se detuvieron temporalmente:

- `resubidos-qa.service`
- `snap.cups.cups-browsed.service`
- `snap.cups.cupsd.service`
- `ModemManager.service`
- `fwupd.service`
- `udisks2.service`

Se mantuvieron activos o se reiniciaron según necesidad:

- `resubidos.service`
- `nginx.service`
- `docker.service`
- `containerd.service`
- PostgreSQL en Docker
- `lolweapon.service`
- `kala-bot.service`
- `kala-stream-downloader.service`
- `ssh.service`
- servicios esenciales de red, resolución DNS, logging y tiempo

Importante: `systemctl stop` solo afecta el runtime actual. Reinicios del Droplet y workflows de despliegue pueden volver a iniciar servicios. El estado debe revisarse después de cada reboot/deploy. Al 22 de agosto, tras despliegues posteriores, QA y `udisks2` habían vuelto a estar activos; CUPS, ModemManager y `fwupd` permanecían inactivos. Este dato es posterior al cierre del incidente y no modifica las acciones históricas.

## Commits y release relacionados

- `5cef61b` — `fix(performance): stabilize live concurrency`
- `ee93473` — `chore(release): bump version to 2.22.1`
- `dc9157a` — `feat(notifications): announce version 2.22.1`
- Tag `v2.22.1` sobre `dc9157a`
- `c651998` — `chore(release): merge dev into main for v2.22.1`

Commits posteriores no forman parte del hotfix original aunque puedan contenerlo como ancestro.

## Verificación completada

- Build Next.js de producción completado correctamente.
- `v2.22.1` desplegado en producción.
- Servicios críticos activos.
- PostgreSQL saludable.
- Notificación de contenido sincronizada `22/22`.
- Cinco solicitudes públicas consecutivas con HTTP 200 en dos muestras.
- Latencia pública mayoritariamente inferior a 0,6 segundos bajo más de 860 conexiones HTTPS.
- Node por debajo de un tercio de un núcleo durante la medición estable.
- Cero sesiones PostgreSQL `idle in transaction`.
- Sin errores Prisma ni timeouts recientes en `journalctl`.
- Presencia deduplicada de 177 usuarios activos en Inicio.
- Sin bloqueos de usuarios ni IP.

## Pendientes

- Ejecutar una prueba de carga controlada que simule 500 usuarios simultáneos y un spike equivalente.
- Certificar después un objetivo de 800 usuarios concurrentes si sigue siendo requisito de producto.
- Medir p50, p95, p99, errores, reconexiones WebSocket, CPU, RAM y pool durante al menos 20–30 minutos.
- Reactivar YouTube y analítica de audiencia de forma independiente, midiendo antes y después de cada flag.
- Revisar si conviene separar o escalar horizontalmente WebSocket/Node. No agregar workers sin resolver estado compartido o afinidad.
- Evaluar caché compartida/Redis solo si la prueba de carga demuestra necesidad.
- Revisar Nginx para registrar `$host` en access logs y facilitar análisis por virtual host.
- Incorporar alertas de latencia, error rate, uso de CPU por proceso y transacciones PostgreSQL abiertas.
- Confirmar política permanente para servicios auxiliares que reaparecen después de reboot o deploy.

## Riesgos conocidos

- Node continúa como un único proceso y puede saturar un núcleo antes de consumir toda la CPU agregada del Droplet.
- Los WebSockets mantienen estado en memoria; múltiples workers requieren sticky sessions o estado compartido.
- El plan sigue usando CPU compartida, por lo que el rendimiento puede variar por presión del host físico.
- YouTube y analítica de audiencia estaban desactivados al cerrar la verificación; reactivarlos cambia el perfil de carga.
- El disco ampliado limita las opciones de downsizing directo.
- El conteo de presencia es una aproximación deduplicada, no una medición contractual de personas únicas.
- Un despliegue puede volver a iniciar QA aunque esté deshabilitado, porque el workflow ejecuta un restart explícito.

## Recomendaciones

1. Mantener `v2.22.1` o posterior y no revertir solamente el resize esperando conservar la misma capacidad.
2. Ejecutar prueba de carga antes del próximo directo de alta audiencia.
3. Definir SLO inicial: menos de 1 % de errores, p95 inferior a 2 segundos, CPU sostenida inferior a 75 %, memoria inferior a 75 % y cero transacciones inactivas prolongadas.
4. Reactivar flags uno a uno fuera del pico, con una ventana de observación de al menos 15 minutos.
5. Mantener una muestra agregada de rutas por host sin almacenar más datos personales de los necesarios.
6. Crear alertas y un dashboard que separen CPU agregada del Droplet y CPU por proceso.
7. Considerar CPU dedicada si las pruebas muestran variabilidad relevante aun con el hotfix.

## Runbook de revisión

### Estado general

```bash
ssh lolweapon '
  systemctl is-active resubidos.service nginx.service docker.service ssh.service
  docker ps --format "table {{.Names}}\t{{.Status}}"
  uptime
  free -h
  df -h /
'
```

### Conexiones y proceso Node

```bash
ssh lolweapon '
  printf "https="
  ss -nt state established "( sport = :443 )" | tail -n +2 | wc -l
  printf "node="
  ss -nt state established "( sport = :3001 )" | tail -n +2 | wc -l
  ps -eo pid,etimes,pcpu,pmem,rss,comm --sort=-pcpu | head -n 10
'
```

`ps` expresa aproximadamente 100 % como un núcleo completo. Para comparar con DigitalOcean Insights debe considerarse la cantidad total de vCPU y la ventana de promedio.

### Latencia local y pública

```bash
ssh lolweapon '
  curl -sS -o /dev/null --max-time 15 \
    -w "local: %{http_code} %{time_total}s\n" \
    http://localhost:3001/
  curl -sS -o /dev/null --max-time 20 \
    -w "public: %{http_code} %{time_total}s\n" \
    https://resubidos.lolweapon.com/
'
```

### Logs de producción

```bash
ssh -t lolweapon '
  sudo journalctl -u resubidos.service --since "30 minutes ago" --no-pager
'
```

### Estados PostgreSQL sin exponer credenciales

```bash
ssh lolweapon '
  docker exec lolweapon-resubidos-postgres sh -c \
    "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -c \\
    \"select state, count(*), max(now() - xact_start) as oldest_transaction \\
    from pg_stat_activity \\
    where datname = current_database() \\
    group by state order by state;\""
'
```

### Revisar únicamente flags booleanos

```bash
ssh lolweapon '
  cd /ruta/al/resubidos
  grep -E "^(YOUTUBE_NOTIFICATION_SYNC_ENABLED|STREAM_AUDIENCE_ANALYTICS_ENABLED)=" .env
'
```

## Reversión y retiro de mitigaciones

### Reactivar YouTube de forma controlada

Hacerlo fuera de un pico y medir antes/después:

```bash
ssh -t lolweapon '
  cd /ruta/al/resubidos
  sed -i "s/^YOUTUBE_NOTIFICATION_SYNC_ENABLED=.*/YOUTUBE_NOTIFICATION_SYNC_ENABLED=true/" .env
  sudo systemctl restart resubidos.service
'
```

### Reactivar analítica de audiencia de forma controlada

```bash
ssh -t lolweapon '
  cd /ruta/al/resubidos
  sed -i "s/^STREAM_AUDIENCE_ANALYTICS_ENABLED=.*/STREAM_AUDIENCE_ANALYTICS_ENABLED=true/" .env
  sudo systemctl restart resubidos.service
'
```

No reactivar ambos flags al mismo tiempo: hacerlo uno por uno y observar al menos 15 minutos.

### Detener nuevamente servicios auxiliares

```bash
ssh -t lolweapon '
  sudo systemctl stop \
    resubidos-qa.service \
    snap.cups.cups-browsed.service \
    snap.cups.cupsd.service \
    ModemManager.service \
    fwupd.service \
    udisks2.service
'
```

Deshabilitar servicios de forma persistente debe decidirse por separado. Los workflows pueden iniciar QA explícitamente aunque la unidad esté deshabilitada.

### Volver a iniciar un servicio detenido por mitigación

```bash
ssh -t lolweapon 'sudo systemctl start <unidad>.service'
```

### Rollback de código

Antes de revertir, revisar si `main` contiene releases posteriores:

```bash
cd /ruta/local/al/lolweapon-resubidos-web
git log --oneline --decorate --graph -20
```

Si `v2.22.1` sigue siendo el último release y es imprescindible revertir todo el merge:

```bash
git checkout main
git pull --ff-only origin main
git revert -m 1 c651998
git push origin main
```

Si existen releases posteriores, no ejecutar ese revert sin revisar dependencias. Preferir una reversión dirigida de los archivos o commits afectados y pasar nuevamente por QA.

### Restaurar configuración desde el respaldo previo

Durante el diagnóstico se creó un respaldo del archivo de entorno antes de desactivar YouTube. No restaurarlo completo sin comparar, porque puede omitir cambios de configuración posteriores. Revisar diferencias sin imprimirlas en canales compartidos y restaurar solo flags booleanos necesarios.

### Rollback del resize

El resize de CPU/RAM puede evaluarse únicamente después de pruebas de carga. Debido al aumento permanente de disco, DigitalOcean puede impedir seleccionar planes con un disco menor. En ese caso el rollback requiere crear un Droplet nuevo compatible y migrar datos/configuración siguiendo el procedimiento de despliegue; no intentar reducir el filesystem en caliente.

## Criterios de rollback futuro

Considerar rollback o mitigación inmediata si, durante al menos cinco minutos:

- la tasa de errores supera 1 %;
- p95 supera 2 segundos de forma sostenida;
- Node mantiene un núcleo cerca de saturación y las colas/conexiones siguen creciendo;
- aparecen nuevamente sesiones `idle in transaction` de larga duración;
- la memoria crece continuamente o comienza a usar swap de forma significativa;
- el flujo principal `/inicio?stream=dual` deja de cargar o los WebSockets entran en reconexión masiva.

## Lecciones aprendidas

- Una operación idempotente no es barata por definición; inicializar permisos en cada request convirtió lecturas públicas en escrituras masivas.
- CPU agregada del Droplet y CPU del proceso Node deben observarse por separado.
- Contar conexiones no equivale a contar usuarios.
- El resize aportó resiliencia, pero la evidencia de recuperación llegó solo después del cambio de software.
- Los WebSockets y fallbacks de polling deben diseñarse juntos para que una caída no genere una estampida.
- Las pruebas de carga deben incluir visitantes invitados, WebSockets persistentes y el comportamiento de reconexión, no solo solicitudes HTTP aisladas.
