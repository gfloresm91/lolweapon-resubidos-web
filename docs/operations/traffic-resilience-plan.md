# Plan de resiliencia ante picos de tráfico

## Propósito y estado

Este documento permite continuar, incluso con otro agente, el trabajo iniciado después del incidente de tráfico del 21 de agosto de 2026. Reúne el diagnóstico confirmado, las medidas ya desplegadas, los cambios locales pendientes y un plan gradual para soportar picos legítimos de al menos 500 usuarios concurrentes sin bloquearlos.

Documento relacionado: [`docs/incidents/2026-08-21-traffic-collapse.md`](../incidents/2026-08-21-traffic-collapse.md). Ese postmortem es la fuente de evidencia, cronología y comandos de diagnóstico. Este archivo es la hoja de ruta de implementación.

Estado actualizado al 29 de agosto de 2026:

- El hotfix `v2.22.1` está en producción y estabilizó el incidente.
- El Droplet fue ampliado a 4 vCPU y 8 GiB de RAM, con CPU compartida.
- Producción continúa usando un solo proceso Node y PostgreSQL local en Docker.
- Las optimizaciones defensivas de la Etapa 1 llegaron a QA y producción; están contenidas en `main` y en el release `v2.25.1`.
- `/directo` está aislado como HTML estático servido por Nginx, dispone de caché específica en Cloudflare para QA y producción y lleva varios días de uso real estable sin errores operativos reportados.
- La entrega estática de `/directo` fue certificada en QA con 4.000/4.000 respuestas HTTP 200 en oleadas de 800 solicitudes TLS nuevas. Esta prueba no certifica todavía toda la aplicación dinámica con 500 usuarios concurrentes sostenidos.
- YouTube y analítica de audiencia permanecían desactivados al cerrar el diagnóstico; antes de reactivarlos se debe verificar el valor efectivo de ambos flags en producción.
- La autorización pública ya no depende del rol `invitado` en PostgreSQL; la Etapa 1.75 quedó certificada en QA. El siguiente bloque es completar observabilidad/alertas antes de la prueba de carga dinámica.
- No se ha decidido instalar Redis/Valkey ni dividir la aplicación en microservicios. Esa decisión depende de mediciones.

## Qué ocurrió

Durante un directo entraron aproximadamente 150–200 usuarios reales simultáneos según la mejor evidencia disponible. Se observaron más de 800 conexiones HTTPS, pero una persona puede abrir varias conexiones HTTP, API y WebSocket; por eso conexiones y usuarios no son equivalentes.

La causa raíz no fue un ataque, Nginx caído, PostgreSQL detenido ni falta de RAM por sí sola. Una lectura pública frecuente de notificaciones resolvía al usuario invitado y ejecutaba repetidamente la inicialización de roles y permisos. Cada solicitud podía provocar decenas de `upsert` en PostgreSQL. El polling y las reconexiones de cientos de navegadores multiplicaron ese trabajo, saturaron la base de datos y ocuparon el event loop del único proceso Node.

El resize dio margen de capacidad, pero no corrigió la causa: Node volvió a saturar un núcleo después de ampliar el servidor. La recuperación ocurrió después del hotfix que eliminó la inicialización por solicitud y redujo la amplificación.

## Medidas ya desplegadas en `v2.22.1`

- Inicialización de permisos una sola vez por proceso, con promesa compartida entre solicitudes concurrentes.
- Menos lecturas duplicadas de sesión y notificaciones.
- Polling de notificaciones como respaldo del WebSocket, con menor frecuencia.
- Reconexión WebSocket con backoff y jitter.
- Heartbeat y limpieza de sockets inactivos.
- Solicitud Twitch compartida y deduplicada en el navegador.
- Límites y timeouts explícitos para el pool PostgreSQL.
- Resize del Droplet de 2 vCPU/4 GiB a 4 vCPU/8 GiB.

Después del hotfix, con unas 860 conexiones HTTPS y 177 usuarios deduplicados, Node bajó aproximadamente de 97 % a 23–32 % de un núcleo y no quedaron sesiones `idle in transaction`.

## Optimizaciones defensivas desplegadas

Estas optimizaciones se implementaron en `0cb5701` (`fix(performance): harden public traffic paths`), pasaron QA y están incluidas en `main`/`v2.25.1`:

- Inicio entrega solo los diez directos recientes y obtiene el catálogo completo al entrar a Rastreador, Calendario, Mi lista o Mantenedor Rastreador.
- El catálogo del Rastreador usa cobertura explícita, una lectura de proceso compartida durante 10 segundos y una única promesa en vuelo. Las mutaciones invalidan esa lectura y emiten `lives:update`; el cliente refresca únicamente si está viendo el catálogo y difiere la actualización en las demás pantallas. Foco y polling de dos minutos quedan como respaldo si se pierde el WebSocket.
- `/api/youtube/videos` deja de sincronizar/escribir por visita, usa caché en proceso, promesa compartida, stale fallback y headers de caché pública.
- `/api/twitch/status` permite caché pública breve.
- Las notificaciones públicas usan un scope explícito, caché breve en proceso, promesa compartida e invalidación al emitir actualizaciones.
- El rol invitado tiene caché y deduplicación breve para evitar una estampida de lecturas. Esta mitigación permanece activa, pero será reemplazada por acceso público definido en código en la Etapa 1.75.
- Las respuestas privadas/autenticadas continúan sin caché pública.

Esta invalidación en tiempo real es local al proceso actual, igual que los demás WebSockets y cachés en memoria. Antes de ejecutar varios workers o instancias se debe mover el evento y la invalidación a Redis/Valkey Pub/Sub o a otro coordinador compartido.

Antes de continuar cualquier etapa se debe revisar `git status` y `git diff`; no confundir cambios locales con código desplegado.

## Flujo adicional de escritura: progreso de reproducción

La app móvil guarda la posición del video aproximadamente cada 12 segundos por usuario que está reproduciendo. La persistencia usa `PlatformUserLivePlayback` y `upsertLivePlayback()`, con una clave única indexada por `userId`, `liveId`, `source` y `partIndex`. La ruta web de reproducción reutiliza el mismo repositorio, por lo que este flujo no debe medirse exclusivamente como tráfico móvil.

Carga máxima teórica si todos los usuarios concurrentes están reproduciendo y sincronizando al mismo tiempo:

| Reproducciones activas | Intervalo | Upserts aproximados |
| ---: | ---: | ---: |
| 200 | 12 segundos | 17 por segundo |
| 500 | 12 segundos | 42 por segundo |
| 800 | 12 segundos | 67 por segundo |

Cuando un video se completa, el repositorio también actualiza mediante `upsert` el estado visto en `PlatformUserLive`. Esa segunda escritura no ocurre en cada tick, solo al recibirse `completed=true`.

Este flujo no cambia la causa raíz del incidente de tráfico público: las escrituras problemáticas eran inicializaciones de permisos que nunca debieron ejecutarse por solicitud. Sin embargo, sí es una carga legítima y sostenida que debe incluirse en las pruebas de capacidad de PostgreSQL.

Antes de optimizarlo, medir latencia, throughput, espera del pool, WAL, I/O y contención del índice. Opciones posteriores, solamente si las mediciones lo justifican:

- agregar jitter al intervalo del cliente para evitar que muchos dispositivos escriban en el mismo segundo;
- no enviar una actualización si la posición no cambió materialmente;
- aumentar el intervalo durante pausa o background y forzar guardado al pausar, salir o cambiar de parte;
- aceptar el progreso en memoria/Redis y consolidarlo de forma asíncrona, conservando una estrategia segura ante pérdida de proceso;
- agrupar escrituras únicamente si se introduce una cola durable y se define cuánto progreso es aceptable perder.

No retrasar el guardado solo para reducir consultas sin validar primero la experiencia esperada de reanudación del video.

## Evaluación de las recomendaciones externas

### Conexiones PostgreSQL

La recomendación de no crear un cliente por solicitud es correcta. La aplicación ya reutiliza un cliente Prisma singleton y un pool acotado. No se debe reducir PostgreSQL a una única conexión total: eso serializaría el trabajo. La unidad correcta es un cliente/pool por proceso Node, con límites, timeouts y consultas eficientes.

### Caché de permisos

Es pertinente y fue central en el incidente. La inicialización repetida ya fue eliminada y el camino invitado dispone de caché breve. Sin embargo, una visita sin sesión todavía puede depender periódicamente de `PlatformRole` y sus permisos en PostgreSQL; la arquitectura objetivo elimina esa dependencia y define explícitamente en código qué superficies son públicas. Para usuarios autenticados puede evaluarse una caché de 30–120 segundos con invalidación al cambiar rol, permisos, estado o sesión.

No cachear permisos durante 30 días sin invalidación confiable. Podría conservar accesos después de desactivar un usuario o revocar permisos.

### Node y uso de CPU

Un proceso Node ejecuta JavaScript principalmente en un event loop y puede saturar un núcleo aunque el Droplet tenga cuatro. Las operaciones I/O con `async/await` no bloquean por sí mismas, pero demasiadas consultas, promesas concurrentes, serialización o trabajo CPU pueden agotar pools y retrasar el event loop.

Levantar varios workers no es un cambio aislado: WebSockets, presencia, cachés y jobs viven en memoria. Antes de escalar horizontalmente se necesita afinidad de conexiones o, preferentemente, Redis/Valkey para estado compartido, Pub/Sub, locks y coordinación de trabajos.

### Redis/Valkey

Redis/Valkey es útil, pero no debe instalarse solo por moda. En un único proceso, una caché en memoria es más simple y rápida. Se vuelve justificable cuando una prueba demuestra saturación del proceso o cuando se agregan varios workers/instancias.

Usos futuros apropiados:

- caché compartida de permisos y respuestas públicas;
- Pub/Sub para notificaciones y WebSockets;
- presencia compartida entre procesos;
- locks y elección de líder para sincronizadores/jobs;
- rate limiting técnico o protección contra estampidas sin bloquear audiencia legítima.

No usar Redis como almacenamiento único de información importante. Su persistencia debe configurarse y los datos durables deben conservarse en PostgreSQL.

### Procesamiento por lotes

Agrupar escrituras es adecuado para chat, telemetría o eventos de alta frecuencia. No era la solución primaria de este incidente: las escrituras de permisos no debían agruparse, sino eliminarse del camino de lectura. Solo implementar batching donde exista un flujo legítimo y medido de muchas escrituras.

### Separación de servicios

No dividir por pantallas o funciones arbitrarias como login. La separación debe seguir dominios de carga y fallo. Los primeros candidatos son downloader/procesamiento pesado, sincronizadores y, si se escala horizontalmente, el canal realtime. Un monolito modular optimizado puede atender esta escala.

## Objetivos y criterios de aceptación

Objetivo inicial: soportar 500 usuarios concurrentes legítimos y un spike de entrada sin indisponibilidad. Objetivo posterior de certificación: 800 usuarios concurrentes si sigue siendo necesario.

Durante una prueba sostenida de 20–30 minutos:

- menos de 1 % de respuestas 5xx;
- p95 menor a 2 segundos para el flujo público principal y APIs críticas;
- ningún reinicio de Node, OOM ni crecimiento continuo de memoria;
- CPU sostenida del proceso por debajo de 75 % de un núcleo como objetivo preventivo;
- pool PostgreSQL sin agotarse y cero transacciones inactivas prolongadas;
- WebSockets estables y sin tormenta de reconexiones;
- recuperación de CPU, memoria y conexiones al retirar la carga.

Registrar también p50, p95, p99, throughput, errores por ruta, event-loop lag, RSS/heap, conexiones de Node/Nginx/PostgreSQL y usuarios deduplicados.

## Plan por etapas

No avanzar automáticamente por todas las etapas. Cada una tiene una decisión de continuar, corregir o detenerse.

### Etapa 1: código defensivo en QA

Objetivo: desplegar y verificar las optimizaciones locales sin tocar aún producción ni agregar infraestructura.

Estado: **completada en QA y producción**. Se implementó el 23 de agosto de 2026 con `0cb5701` (`fix(performance): harden public traffic paths`) y documentación `ec6cc40`; posteriormente llegó a `main` y está incluida en `v2.25.1`. El build de producción terminó correctamente; los flujos invitados y autenticados pasaron el smoke test; QA respondió cinco veces con HTTP 200 en aproximadamente 18–70 ms; `resubidos-qa.service` quedó activo con cero reinicios; PostgreSQL mostró cero sesiones `idle in transaction`; no aparecieron errores propios de la aplicación. Se observaron un 404 externo de Amazon IVS y un `MaxListenersExceededWarning` del reproductor, registrados para revisión pero no bloqueantes para esta etapa.

1. Revisar el estado y diff local, cuidando cambios ajenos.
2. Cambiar a `dev`, repetir `npm run build` si hubo modificaciones posteriores y crear el commit de rendimiento.
3. Hacer push a `dev` para desplegar QA.
4. Confirmar que el workflow terminó correctamente y `resubidos-qa.service` está activo.
5. Ejecutar smoke test en QA como invitado y autenticado:
   - Inicio y modo dual;
   - notificaciones y WebSocket;
   - estado Twitch;
   - videos recientes de YouTube;
   - navegación interna y directa a Rastreador, Calendario y Mi lista;
   - comprobar que Inicio carga solo diez directos y que las vistas completas recuperan el catálogo.
6. Revisar logs de QA y ausencia de errores Prisma/Next.js.

Criterio de salida: build y deploy correctos, rutas principales funcionales, datos privados nunca cacheados públicamente y sin errores nuevos en logs.

Rollback: revertir el commit mediante un commit nuevo en `dev` y volver a desplegar. No usar `git reset --hard` ni restaurar archivos con cambios ajenos.

### Etapa 1.5: aislar el punto caliente `/directo`

Objetivo: sacar el modo dual, destino de entrada masiva durante los directos, del camino dinámico de Inicio.

Estado al 29 de agosto de 2026: **completada, certificada en QA y desplegada en producción**. QA sirve `/var/www/resubidos-qa/directo.html` y producción `/var/www/resubidos/directo.html`; los workflows actualizan las copias. Con Node QA detenido, `/directo` mantuvo HTTP 200 mientras `/inicio` devolvió 502. Cinco oleadas de 800 solicitudes TLS nuevas entregaron 4.000/4.000 respuestas HTTP 200, cero errores y p95 de 1,56 s; servicios y recursos quedaron saludables. Cloudflare tiene reglas de caché limitadas a `/directo` y `/directo-status.json` en ambos ambientes. Después del despliegue, `/directo` lleva varios días funcionando correctamente bajo uso real y no se han reportado caídas ni errores operativos.

Decisión y diseño: [`docs/architecture/directo-static.md`](../architecture/directo-static.md).

1. Crear un HTML estático autónomo con VK, Twitch, chat y controles mínimos.
2. Mantener responsive real y compatibilidad con `?layout=android` para navegadores móviles.
3. No resolver sesión/permisos, consultar PostgreSQL, llamar APIs dinámicas internas ni abrir WebSockets propios. La única metadata se entrega mediante `/directo-status.json`, un snapshot público, cacheable y no crítico.
4. Hacer que los enlaces web de modo dual abran `/directo` y conservar fallback para enlaces existentes.
5. Servir el archivo directamente desde Nginx en QA antes del proxy hacia Next.
6. Validar visualmente en desktop/móvil: intercambio, tamaño, chat superpuesto, modales y recuperación de Twitch; comprobar cero llamadas dinámicas internas.
7. Detener controladamente Node QA y confirmar que `/directo` continúa respondiendo.
8. Ejecutar una prueba de 500–800 solicitudes concurrentes contra el archivo.
9. Repetir configuración y verificación en producción mediante release normal.

Criterio de salida: `/directo` funciona aunque Next QA esté detenido, los embeds y chat mantienen su funcionalidad y el pico de solicitudes no genera trabajo en Node/PostgreSQL.

Resultado: **cumplido** para la entrega propia de `/directo`. La capacidad y políticas internas de reproducción de Twitch/VK pertenecen a los proveedores y se evalúan por separado de la resiliencia del origen.

### Etapa 1.75: retirar el rol invitado dependiente de PostgreSQL

Objetivo: hacer que una solicitud sin sesión nunca necesite leer roles o permisos desde PostgreSQL para decidir si una superficie pública puede mostrarse.

Estado al 29 de agosto de 2026: **completada y certificada en QA** mediante `0b0306b` (`fix(performance): decouple public access and refresh tracker data`). Los validadores privados exigen sesión, las superficies públicas usan una política inmutable en código, web y móvil dejaron de resolver un rol invitado y el mantenedor ya no lo ofrece. El smoke test local y la validación funcional en QA pasaron. `resubidos-qa.service` quedó activo con el commit esperado; la migración retiró `invitado` de `PlatformRole` y se verificaron cero usuarios con `roleId` nulo. El paso a producción queda reservado para el release posterior a las etapas de certificación acordadas.

Política y matriz inicial: [`docs/architecture/public-access-policy.md`](../architecture/public-access-policy.md).

Decisión de arquitectura:

- Las rutas, páginas y lecturas realmente públicas se declaran explícitamente en código; no se habilitan mediante asignaciones de permisos al rol `invitado` en la base de datos.
- Las rutas privadas resuelven primero una sesión válida y después permisos configurables del usuario autenticado. Sin sesión deben responder o redirigir como no autorizadas, sin consultar un rol público persistido.
- Puede mantenerse un contexto sintético e inmutable de visitante sin sesión para props/UI (`isAuthenticated: false`, estado local y mensajes), pero no un `PlatformRole` administrable ni una lectura de permisos desde PostgreSQL.
- La campana invitada obtiene únicamente notificaciones con `audience: all`, por regla de código, y conserva leído/descartado en `localStorage`; no necesita `notifications.view` desde BD.
- Las Tier Lists públicas permiten interacción local por regla de ruta/código; guardar o mutar continúa exigiendo sesión y permisos.
- Inicio, Rastreador y su detalle, Viendo, Terminados, RTFM, Novedades, Changelog, Tier Lists, login/registro y `/directo` conservan el acceso que históricamente tenía `invitado`, ahora mediante una lista explícita en código. No asumir que todo GET es público.
- La app móvil debe distinguir endpoints públicos de endpoints con bearer token sin caer a un rol cargado desde PostgreSQL.

Implementación prevista:

1. Inventariar todas las llamadas a `getPublicAccessUser()`, `getAccessUserFromToken()` y validadores que aceptan fallback invitado.
2. Clasificar cada ruta como pública, autenticada o autenticada con permiso.
3. Crear una política pública inmutable en código y helpers separados para acceso público y autorización autenticada.
4. Migrar notificaciones públicas, Tier Lists, RTFM/Novedades/Changelog y APIs móviles públicas a esa política.
5. Retirar el fallback a `getPublicAccessUser()` de validadores de permisos privados.
6. Eliminar el rol `invitado` del mantenedor, seeds/asignaciones y base de datos mediante una migración versionada, solo después de retirar todas sus dependencias.
7. Conservar compatibilidad visual donde componentes actualmente usan la cadena `invitado`, reemplazándola gradualmente por `isAuthenticated` o un contexto sintético no persistido.
8. Probar acceso directo y navegación interna como visitante, usuario común y administración; verificar que cero consultas a `PlatformRole`/`PlatformRolePermission` provengan de tráfico sin sesión.
9. Ejecutar una prueba concurrente de rutas públicas antes de continuar con la certificación dinámica general.

Criterio de salida: las solicitudes sin sesión no consultan roles/permisos en PostgreSQL, las superficies públicas acordadas siguen disponibles, las rutas privadas continúan protegidas y el rol `invitado` ya no existe como configuración persistida.

Rollback: conservar temporalmente el helper anterior detrás de un commit reversible hasta completar QA; si una superficie pública queda inaccesible, revertir mediante un commit nuevo sin restaurar la inicialización por solicitud.

### Etapa 2: observabilidad y alertas

Objetivo: conocer el límite antes de otro directo y detectar degradación antes de una caída.

Estado al 30 de agosto de 2026: **en progreso**. El agente de DigitalOcean `3.18.14` está activo y producción, QA, Nginx y PostgreSQL se encontraron saludables. La primera capa de métricas estructuradas del proceso Node se desplegó en QA mediante `68c8836` (`feat(observability): add Node process metrics`) y quedó validada con cero reinicios. DigitalOcean tiene alertas activas para CPU agregada sobre 70% durante 5 minutos, memoria sobre 80% durante 5 minutos, disco sobre 80% durante 5 minutos y carga media de 5 minutos sobre 3 durante 5 minutos, todas limitadas al Droplet `kalaplex`.

Línea base inicial de QA, tomada con intervalos de 60 segundos y el servicio prácticamente en reposo:

- CPU del proceso: 0,52–0,60% de un núcleo.
- RSS: 248,4–249,4 MiB; heap usado: 122,9–125,3 MiB.
- Utilización del event loop: 0,25–0,39%.
- Retraso del event loop: p95 de 20,19–20,55 ms, p99 de 20,68–21,33 ms y máximos aislados de 26,15–53,77 ms.
- Conexiones observadas: 1 HTTP, 1 WebSocket de notificaciones y 0 WebSockets de presencia.
- Host: carga `0.16, 0.11, 0.09`, 1,3 GiB usados de 7,8 GiB de RAM, 39 MiB de swap usados y 24 GiB usados de 232 GiB de disco.
- systemd: servicio activo, `NRestarts=0`, memoria actual aproximada de 223 MiB y peak acumulado aproximado de 381 MiB.

Estos valores describen reposo y no constituyen todavía límites de capacidad. Se usarán para comparar las mediciones bajo concurrencia de la Etapa 4.

La observabilidad de Nginx quedó validada con un log JSON separado, sin IP, User-Agent ni query string, y un `stub_status` limitado a `127.0.0.1:8088`. La primera muestra de 15 minutos registró 607 entradas y cero errores críticos `499/502/503/504`. Producción mostró p50 HTTP de 6 ms, p95 de 127 ms y p99 de 364 ms; los cierres de WebSocket se separaron de estos percentiles mediante `connectionType`. El analizador versionado `scripts/summarize-nginx-observability.mjs` quedó validado en QA. La ejecución periódica se instala como un servicio `oneshot` de baja prioridad y un timer cada 15 minutos, documentados en `docs/operations/nginx-observability.md`.

El inventario inicial de PostgreSQL 16.13 confirmó una instancia compartida por producción y QA, bases pequeñas de 23 MiB y 18 MiB, cero temporales, cero deadlocks, cero esperas por locks y cache hit superior a 99,99%. Los pools liberaron conexiones idle según el timeout de 30 segundos. Como `pg_stat_statements` no está instalado, `track_io_timing` está apagado y habilitarlos exigiría intervenir la instancia compartida, se eligió un recolector externo de snapshots agregados. `scripts/summarize-postgres-observability.mjs` calcula deltas por base cada 15 minutos sin registrar SQL ni credenciales; su instalación root-owned y timer están documentados en `docs/operations/postgres-observability.md`.

La primera ventana con deltas registró 0,694 transacciones/s en producción y 0,085 en QA, sin temporales, deadlocks, locks ni actividad superior a un segundo. Para aislar el costo del progreso de reproducción, el resumen Nginx normaliza las rutas web y móvil de playback y el snapshot PostgreSQL incorpora deltas globales de WAL. Esta instrumentación mide el costo antes de cambiar la frecuencia de guardado.

La prueba controlada de reproducción en QA registró 16 guardados web, todos `200`, con promedio de 18,44 ms y p95/p99 de 28 ms; no produjo locks, temporales ni deadlocks. El intervalo global compartido generó aproximadamente 739 bytes/s de WAL, cifra que incluye producción y por eso no se atribuye exclusivamente al playback. A partir de esta evidencia, la sincronización web cambió de 5 a 12 segundos reproducidos, conservó guardados por pausa, visibilidad, salida y finalización, añadió `keepalive` y deduplicó posiciones sin cambios. Esto reduce en aproximadamente 58% las escrituras periódicas antes de la prueba concurrente.

1. Activar o validar DigitalOcean Monitoring Agent.
2. Crear alertas de CPU agregada, memoria, swap y disco.
3. Agregar métricas por proceso Node: CPU, RSS/heap, reinicios y event-loop lag.
4. Medir Nginx: tasa de solicitudes, conexiones activas, 499/502/503/504 y latencia.
5. Medir PostgreSQL: conexiones por estado, pool ocupado/esperando, consultas lentas e `idle in transaction`.
6. Medir por separado los `upsert` de progreso de reproducción: escrituras por segundo, latencia, WAL e I/O.
7. Mejorar access logs para incluir host, status, tiempo total y upstream sin guardar datos personales innecesarios.
8. Definir destinatarios y runbook de respuesta para cada alerta.

Criterio de salida: dashboard utilizable y una alerta de prueba recibida correctamente. No ejecutar prueba de carga significativa sin esta etapa.

### Etapa 3: Nginx y límites técnicos seguros

Objetivo: manejar HTTP y WebSocket correctamente sin bloquear a los usuarios válidos.

1. Respaldar y validar la configuración actual con `sudo nginx -T`.
2. Usar un `map` para enviar `Connection: upgrade` solo cuando corresponda.
3. Revisar timeouts de proxy/WebSocket, keepalive, buffers y límites de archivos abiertos.
4. No aplicar rate limits globales que rechacen una entrada legítima de 500 usuarios.
5. Validar con `sudo nginx -t` antes de recargar.

Criterio de salida: HTTP normal y ambos WebSockets operativos, sin errores de sintaxis ni reconexiones adicionales.

### Etapa 4: prueba de carga representativa

Objetivo: medir capacidad real, no estimarla por hardware.

Estado al 30 de agosto de 2026: el pico público inicial de `/inicio` quedó certificado hasta 400 conexiones TLS simultáneas desde un generador externo. Los escalones de 50, 100, 200, 300 y 400 completaron sin fallos ni respuestas críticas; en 400, Nginx registró 402 respuestas `200`, promedio de 3,16 s, p95 de 5,36 s y máximo de 5,39 s. El proceso QA no se reinició, alcanzó aproximadamente 14,3% de un núcleo, 439 MiB RSS y mantuvo el retraso del event loop controlado. El escalón de 500 conservó cero `499/502/503/504` y Nginx terminó las solicitudes con p95 de 7,40 s, pero el generador agotó su timeout de 10 segundos en 3 de 500 solicitudes; por eso se considera estable con degradación y no una certificación limpia. PostgreSQL permaneció sin locks, transacciones idle, temporales ni deadlocks, con cache hit superior a 99,99%. Estas oleadas certifican entradas HTML concentradas, no usuarios sostenidos, ejecución JavaScript, WebSockets ni reproducciones autenticadas.

El escenario público sostenido se ejecuta desde una máquina externa con `npm run load:public -- --users 50 --duration 300 --ramp 60`. Cada visitante carga `/inicio`, las APIs públicas de notificaciones y YouTube, abre WebSockets de notificaciones y presencia, envía el `join` y heartbeat de presencia con la cadencia real y permanece conectado durante la duración configurada. El script rechaza destinos que no parezcan QA salvo que se entregue explícitamente `--allow-non-qa`, opción que no debe usarse sin autorización para probar otro ambiente.

El primer escalón sostenido de 50 visitantes completó 150/150 solicitudes HTTP `200` y 100/100 conexiones WebSocket sin errores. La presencia efectiva llegó a 50 usuarios después de los 15 segundos de calificación y volvió a cero al cerrar el escenario. Nginx registró p95 HTTP de 118 ms y máximo de 300 ms en QA. Durante la rampa Node alcanzó aproximadamente 7% de un núcleo; en estado estable se mantuvo alrededor de 0,55–1,46%, con event-loop p95 cercano a 20–21 ms. El RSS subió desde aproximadamente 260 MiB hasta 287 MiB y volvió a unos 261 MiB después del cierre; no hubo reinicios. PostgreSQL QA registró 0,46 transacciones/s, una conexión, cache hit superior a 99,99% y cero locks, actividad prolongada, temporales o deadlocks. El WAL global compartido promedió aproximadamente 1,65 KiB/s y no se atribuye exclusivamente a QA.

El escalón sostenido de 100 visitantes completó 300/300 solicitudes HTTP `200` y 200/200 conexiones WebSocket sin errores; la presencia llegó a 100 y volvió a cero después de la gracia de cierre. Nginx observó 310 respuestas HTTP `200` y 200 upgrades `101`, con p95 HTTP de 40 ms y máximo de 123 ms. Node alcanzó aproximadamente 7% de un núcleo durante la rampa y se mantuvo alrededor de 0,6–0,8% en estado estable, con event-loop p95 cercano a 20–21 ms. El RSS se mantuvo alrededor de 259 MiB y luego volvió a unos 232 MiB; no hubo reinicios. PostgreSQL QA registró aproximadamente 1,02 transacciones/s, una conexión, cache hit superior a 99,99% y cero locks, actividad prolongada, temporales o deadlocks.

El escalón sostenido de 200 visitantes completó 600/600 solicitudes HTTP `200` y 400/400 conexiones WebSocket sin errores; la presencia llegó a 200 y volvió a cero. Nginx observó 609 respuestas HTTP `200` y 400 upgrades `101`, con p95 HTTP de 37 ms y máximo de 156 ms. Node alcanzó aproximadamente 15,82% de un núcleo y 383 MiB RSS durante la rampa; en estado estable bajó a aproximadamente 0,63–2,61% y 264–265 MiB, con event-loop p95 cercano a 21–22 ms. Después del cierre, el RSS volvió a unos 238 MiB y no hubo reinicios. PostgreSQL QA registró aproximadamente 0,085 transacciones/s, una conexión, cache hit superior a 99,99% y cero locks, actividad prolongada, temporales o deadlocks.

El objetivo sostenido de 500 visitantes públicos quedó certificado con una rampa de 120 segundos y cinco minutos de permanencia por visitante. El generador completó 1.500/1.500 solicitudes HTTP `200` y 1.000/1.000 conexiones WebSocket sin errores; la presencia llegó a 500 y luego volvió a cero. Nginx observó 1.510 respuestas HTTP `200` y 1.000 upgrades `101`, con p95 HTTP de 36 ms y máximo de 127 ms. Node alcanzó aproximadamente 18,05% de un núcleo y 433 MiB RSS durante la rampa; en estado estable bajó a aproximadamente 0,51–1,39% y 271–273 MiB, con event-loop p95 cercano a 21–22 ms y máximo aislado de 74 ms. Después del cierre, el RSS volvió a unos 250 MiB; el peak de systemd quedó en aproximadamente 475 MiB y no hubo reinicios. PostgreSQL QA registró aproximadamente 0,078 transacciones/s, una conexión, cache hit superior a 99,99% y cero locks, actividad prolongada, temporales o deadlocks. Esta evidencia satisface el objetivo público sostenido de 500 visitantes para el patrón probado; la certificación de reproducciones autenticadas continúa separada.

La prueba autenticada usa `load:playback:fixture` para crear usuarios y sesiones efímeros únicamente cuando el nombre de `DATABASE_URL` termina en `_qa`. Los tokens sin hash se guardan fuera del repositorio en un fixture `/tmp` con permisos `0600`; `load:playback` lo consume desde el generador externo y reproduce el intervalo real de 12 segundos. La acción `cleanup` valida tanto los IDs como el prefijo único de la corrida antes de eliminar los usuarios, y las sesiones y progresos asociados desaparecen por cascada. El fixture debe limpiarse después de cada serie aunque la prueba se interrumpa.

La persistencia autenticada quedó certificada en escalones de 50, 100, 200 y 500 reproducciones, con 25 guardados por usuario y rampas de 60 segundos hasta 200 y 120 segundos para 500. Todos los escalones completaron sin errores: 1.250, 2.500, 5.000 y 12.500 respuestas `200`, respectivamente. En el objetivo de 500, Nginx registró exactamente 12.500 escrituras a 20,83 solicitudes/s promedio sobre la ventana, con latencia promedio de 19,53 ms, p95 de 37 ms, p99 de 55 ms y máximo de 196 ms. El generador externo observó p95 de 303 ms, p99 de 378 ms y máximo de 1,01 s incluyendo red, TLS y proxy.

Durante las 500 reproducciones Node alcanzó aproximadamente 38,35% de un núcleo, utilización del event loop de 33,7%, retraso p95 cercano a 23 ms y máximo aislado inferior a 60 ms. El RSS se mantuvo alrededor de 417–430 MiB durante la carga; systemd conservó un peak acumulado aproximado de 534 MiB y no registró reinicios. PostgreSQL QA procesó aproximadamente 188 transacciones/s con una sola conexión observada, cache hit superior a 99,99% y cero locks, actividad prolongada, temporales o deadlocks. El WAL global compartido promedió aproximadamente 7 KiB/s; su delta total fue cercano a 3,3 MiB en 458 segundos. Esta evidencia satisface el objetivo de 500 reproducciones autenticadas concurrentes para el patrón de sincronización distribuido cada 12 segundos; no representa el peor caso artificial donde todos los clientes escriben en el mismo instante.

El peor caso artificial se ensayó aparte con 500 usuarios enviando un único guardado simultáneo. Las 500 solicitudes terminaron en `200`, sin timeouts ni errores críticos. El generador observó p50 de 3,38 s, p95 de 4,99 s y máximo de 5,14 s; Nginx midió promedio de 1,71 s, p95 de 2,72 s y máximo de 2,76 s. PostgreSQL promedió aproximadamente 29,88 transacciones/s sobre la ventana, sin locks, actividad prolongada, temporales ni deadlocks. Node no se reinició y recuperó su memoria, pero registró un retraso máximo aislado del event loop de aproximadamente 1,03 s aunque su p95 permaneció cerca de 21 ms. El pulso queda clasificado como tolerado con degradación transitoria; el cliente debe conservar la distribución natural de ticks y no sincronizar deliberadamente todos los guardados.

1. Preparar un escenario con usuarios invitados, páginas HTML, APIs públicas y WebSockets persistentes.
2. Usar datos de prueba y evitar mutaciones destructivas.
3. Separar al menos dos escenarios: pico web invitado y reproducciones autenticadas con guardado cada 12 segundos.
4. En el escenario de reproducción, distribuir los ticks durante la ventana o reproducir el patrón real del cliente; también ensayar una sincronización accidental para conocer el peor caso.
5. Ejecutar escalones de 50, 100, 200 y 500 usuarios; sostener el nivel objetivo entre 20 y 30 minutos.
6. Simular un spike de entrada y reconexión, no solo requests HTTP aislados.
7. Capturar métricas y detener si se superan los criterios de rollback.
8. Corregir cuellos medidos y repetir hasta obtener un resultado reproducible.
9. Certificar después 800 usuarios si el negocio lo requiere.

Criterio de salida: informe con configuración, commit probado, resultados, gráficos, fallos y capacidad certificada. No probar por primera vez contra producción durante un directo.

### Etapa 5: reactivación controlada de funciones

Objetivo: recuperar funciones desactivadas sin mezclar variables.

1. Establecer una línea base con ambos flags apagados.
2. Reactivar YouTube fuera de un pico, reiniciar producción y observar al menos 15–30 minutos.
3. Ejecutar smoke/load test comparable y documentar diferencia.
4. Si es estable, repetir separadamente con analítica de audiencia.
5. Si una función degrada el sistema, volver a apagar solo ese flag y optimizarla antes de reintentar.

Criterio de salida: cada función tiene evidencia independiente de su costo y una decisión documentada.

### Etapa 6: release productivo y ensayo controlado

Objetivo: llevar a producción solamente el conjunto certificado en QA.

1. Integrar `dev` en `main` siguiendo el workflow del repositorio.
2. Hacer bump de versión en `package.json` y `package-lock.json`.
3. Crear commit de release, tag y push manual por parte del usuario.
4. Desplegar en una ventana de bajo tráfico con rollback preparado.
5. Ejecutar smoke test y observar métricas/logs.
6. Si es seguro y está autorizado, ejecutar un ensayo productivo acotado por debajo de la capacidad certificada.

Criterio de salida: producción estable y métricas comparables o mejores que QA.

### Etapa 7: decisión Redis/Valkey y múltiples procesos

Activar esta etapa si un solo proceso satura un núcleo, el event loop excede el objetivo, se necesitan varias instancias o el estado realtime debe compartirse.

1. Inventariar todo estado en memoria, timers y jobs de `server.mjs`.
2. Introducir Redis/Valkey primero para caché compartida, Pub/Sub, presencia, locks y elección de líder.
3. Definir expiración e invalidación de permisos; nunca confiar solo en TTL largo.
4. Evitar que sincronizadores y publicaciones programadas se ejecuten una vez por worker.
5. Probar fallo y recuperación de Redis; la web debe degradar de manera controlada.
6. Agregar dos workers o dos instancias detrás de un balanceador.
7. Repetir pruebas de carga, WebSocket, reconexión y failover.

Criterio de salida: pérdida de una instancia sin caída pública, jobs sin duplicarse y estado realtime consistente.

### Etapa 8: aislamiento y alta disponibilidad

Esta etapa reduce dominios de fallo y corresponde cuando el costo/criticidad lo justifique.

Arquitectura objetivo posible:

```text
Cloudflare/CDN
      |
DigitalOcean Load Balancer
      |
  +---+---+
  |       |
App 1   App 2
  |       |
  +---+---+
      |
Redis/Valkey administrado
      |
PostgreSQL administrado con HA
```

Acciones:

1. Servir estáticos/cache público mediante CDN.
2. Separar downloader y procesamiento pesado del host web.
3. Desplegar al menos dos instancias web en dominios de fallo distintos.
4. Usar Load Balancer con health checks.
5. Migrar a PostgreSQL administrado con alta disponibilidad si el presupuesto lo permite.
6. Mover archivos compartidos a object storage cuando corresponda.
7. Ensayar pérdida de una app, Redis y nodo de base de datos.

Criterio de salida: no existe un único proceso o Droplet cuya caída deje la web completamente indisponible.

## Prompt de continuidad para otra IA

Copiar el siguiente prompt y ajustar únicamente la etapa solicitada:

```text
Trabaja en el repositorio /Users/gabriel/Developer/kala-apps/lolweapon-resubidos-web.

Antes de proponer o ejecutar cambios:
1. Lee completamente AGENTS.md y respeta sus instrucciones.
2. Lee CLAUDE.md, docs/project-overview.md, docs/incidents/2026-08-21-traffic-collapse.md y docs/operations/traffic-resilience-plan.md.
3. Revisa git status, git diff y el historial reciente. El worktree puede contener cambios del usuario o de otra IA: no los reviertas ni los sobrescribas.
4. Comprueba qué partes del plan están realmente desplegadas; no confundas cambios locales, QA y producción.

Continúa con la etapa [INDICAR NÚMERO Y NOMBRE] del plan de resiliencia. Primero valida los criterios de entrada de esa etapa, después entrega el paso a paso y ejecuta solamente las acciones seguras autorizadas. Yo ejecuto manualmente git add, commit, tag y push. Si necesitas sudo en el servidor, dame los comandos exactos para que yo los ejecute; el alias SSH es lolweapon. No imprimas secretos, valores de .env, tokens, credenciales ni argumentos completos de procesos.

El tráfico de 500 o más usuarios es legítimo y debe ser atendido, no bloqueado. No implementes rate limits punitivos como sustituto de capacidad. Usa mediciones de CPU por proceso y agregada, memoria, event-loop lag, latencias p50/p95/p99, errores, conexiones, WebSockets y PostgreSQL. Detente y explica la evidencia si una decisión requiere Redis/Valkey, varios workers, nueva infraestructura o gasto recurrente.

Al terminar, documenta lo aplicado, las verificaciones, resultados, rollback, pendientes y el estado exacto de la siguiente etapa. Ejecuta npm run build después de cambios de código. No hagas cambios Git de escritura salvo que te lo solicite expresamente.
```

## Regla de continuidad

Al finalizar cada etapa, actualizar este documento con fecha, commit, entorno, resultados y decisión. Una etapa no se considera completada solo porque el código exista: debe cumplir sus criterios de aceptación en el entorno correspondiente.
