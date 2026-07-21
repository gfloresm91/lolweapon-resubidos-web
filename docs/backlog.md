# Backlog

Tareas pendientes, ideas y mejoras diferidas. Actualizar con cada sesión relevante.

## En progreso / Próximo

### Feature: Google/YouTube y cuentas conectadas

- **Estado:** implementada en `feature/auth-identities` (2026-07-04); pendiente configuración OAuth, migración y pruebas reales en QA.
- **Alcance:** cuenta canónica `PlatformUser`, identidades Twitch y Google/YouTube, alta OAuth mediante `/registro?oauth=...` con email bloqueado y contraseña opcional, vinculación mediante reautenticación y gestión desde Perfil.
- **Roles:** la migración conserva `roleId`; `roleSource` distingue asignaciones manuales de sincronizaciones Twitch. Google/YouTube inicia como `publico`; Twitch aplica reglas automáticas al registrar o conectar sobre rol `publico`.
- **Fuera de alcance:** detección de membresía con `members.list`, condicionada a autorización del creador y acceso oficial de YouTube.
- **Pendiente operativo:** configurar credenciales y redirect URI de Google por ambiente, aplicar la migración y completar pruebas OAuth reales en local/QA.

### ~~Feature: Centro y mantenedor de notificaciones~~

- **Estado:** Implementada en `feature/notification-management` (2026-06-28). Pendiente aplicar la migración versionada y completar pruebas visuales autenticadas con datos PostgreSQL.
- **Objetivo:** agregar una página completa para que usuarios autenticados administren sus notificaciones y un mantenedor administrativo para gestionar tanto notificaciones manuales como automáticas.
- **Rutas acordadas:**
  - `/notificaciones` — centro completo para el usuario.
  - `/administracion/notificaciones` — mantenedor administrativo.
- **Permisos nuevos:**
  - `notifications.view` — muestra la campana; asignado al rol invitado para avisos públicos.
  - `notifications.full.view` — permite “Ver todas” y acceder a `/notificaciones`; no asignado al rol invitado.
  - `admin.notifications.view`
  - `admin.notifications.create`
  - `admin.notifications.update`
  - `admin.notifications.delete`
- **Asignación inicial:** asignar automáticamente solo `notifications.view` a `invitado`; el resto no se asigna a roles predefinidos. `Dios` los obtiene por su regla general de acceso total; no agregarlos a sus exclusiones.
- **Centro de usuario:**
  - Requiere sesión y permiso `notifications.full.view`; no tendrá soporte de página completa para invitados.
  - Listar todas las notificaciones visibles según su audiencia.
  - Buscar por título/contenido y filtrar por tipo, estado y fecha.
  - Implementar paginación real.
  - Permitir marcar como leída o no leída, marcar todas como leídas, descartar y restaurar.
  - Mantener actualización por WebSocket.
  - Agregar `Ver todas` al dropdown actual únicamente con `notifications.full.view`.
  - Ocultar la campana cuando el usuario no tenga `notifications.view`.
- **Mantenedor administrativo:**
  - Administrar notificaciones manuales y automáticas de Twitch, YouTube, rastreador, anime y sistema.
  - Crear, editar, activar/desactivar, eliminar lógicamente y restaurar.
  - Permitir publicación inmediata o programada y fecha de expiración.
  - Audiencias soportadas: todos, usuarios autenticados, administración, permiso específico y usuario específico.
  - Usar `MaintainerStats`, `MaintainerToolbar`, `MaintainerTable`, `MaintainerModal`, `ConfirmModal`, `FilterSelect` y `FormSelect`.
  - Columnas sugeridas: `ID`, `Título`, `Tipo`, `Severidad`, `Audiencia`, `Origen`, `Creada`, `Publicación`, `Expira`, `Estado`, `Acciones`.
  - Registrar operaciones en `AuditLog` con módulo `admin.notifications` y snapshots sanitizados.
- **Persistencia propuesta:** ampliar `PlatformNotification` con `source`, `isActive`, `scheduledAt`, `publishedAt`, `updatedAt` y `deletedAt`.
  - Migrar las notificaciones existentes como publicadas usando su `createdAt`.
  - Usar eliminación lógica para conservar `dedupeKey` y evitar que notificaciones automáticas eliminadas reaparezcan al reiniciar `server.mjs`.
  - Una notificación es visible solo si está activa, publicada, no eliminada y no expirada, además de cumplir su audiencia.
- **Programación:**
  - `server.mjs` debe ejecutar un sincronizador periódico de publicaciones pendientes.
  - Al alcanzar `scheduledAt`, asignar `publishedAt` de forma segura y emitir `notifications:update` por WebSocket una sola vez.
  - Las notificaciones automáticas actuales se crean con publicación inmediata.
  - Validar que la expiración sea posterior a la publicación programada.
- **Repositorio y APIs:**
  - Extender `lib/repositories/notificationRepository.js` con filtros, paginación, marcar no leída, restaurar descartadas y CRUD administrativo.
  - Mantener `/api/notifications`: la campana exige `notifications.view`, la página completa exige sesión y `notifications.full.view`, y las mutaciones autenticadas aceptan cualquiera de ambos permisos.
  - Crear `/api/admin/notifications` para el mantenedor y validar permisos por acción.
  - Responder JSON estructurado y emitir actualizaciones realtime después de cambios que afecten visibilidad.
- **Integración de rutas/UI:**
  - Crear componentes separados para ambas pantallas para no seguir concentrando lógica en `HomePage.js`.
  - Integrarlas en `HomePage` únicamente como vistas, labels, paths, permisos y props iniciales.
  - Agregar ambas opciones a `AppSidebar`.
  - Soportar acceso directo con datos del Server Component y navegación interna SPA desde cualquier vista.
  - Agregar `loading.js` para ambas rutas.
- **Archivos probables:**
  - `prisma/schema.prisma`
  - `prisma/migrations/YYYYMMDDHHMMSS_expand_platform_notifications/migration.sql`
  - `lib/repositories/notificationRepository.js`
  - `lib/repositories/platformUserRepository.js`
  - `lib/notificationRealtime.js`
  - `server.mjs`
  - `app/api/notifications/route.js`
  - `app/api/admin/notifications/route.js`
  - `app/notificaciones/page.js` y `loading.js`
  - `app/administracion/notificaciones/page.js` y `loading.js`
  - componentes nuevos para el centro completo, mantenedor y formulario
  - `components/NotificationCenter.js`, `components/AppSidebar.js`, `components/HomePage.js`
  - `app/globals.css`
  - `docs/project-overview.md`, `docs/design-system.md`, `AGENTS.md` y `CLAUDE.md` si se consolidan reglas nuevas.
- **Verificación prevista:**
  - `npm run db:generate`
  - `npm run build`
  - `git diff --check`
  - Probar acceso directo y navegación interna para ambas rutas.
  - Probar permisos de vista y acciones con rol común, rol configurado y `Dios`.
  - Probar notificación inmediata, programada, expirada, desactivada, eliminada y restaurada.
  - Probar leer/no leer, descartar/restaurar, marcar todas y recepción WebSocket.
  - Playwright autenticado en las resoluciones definidas en `docs/workflows/new-feature.md`, incluyendo tabla con scroll horizontal, modales y menú lateral mobile.
- **Rama sugerida:** partir desde `dev` con `feature/notification-management`.
- **Decisiones ya confirmadas:** usuarios autenticados solamente; restaurar y marcar como no leída; administrar todas las fuentes; programación futura; permisos sin asignación predeterminada salvo la regla general de `Dios`.

### Evaluación arquitectónica: SPA, App Router y división de `HomePage`

- **Estado:** pendiente para después de implementar la feature de notificaciones.
- **Objetivo:** evaluar con métricas y dependencias reales si conviene mantener la experiencia SPA actual, evolucionar hacia rutas más independientes con App Router o adoptar otra combinación de renderizado.
- **Contexto actual:** la aplicación ya es híbrida: las rutas directas se renderizan en servidor, mientras `HomePage` mantiene navegación interna sin recarga mediante `currentView`. El problema principal identificado no es la experiencia SPA, sino la concentración de muchas vistas, datos y estado en `components/HomePage.js`.
- **Hipótesis inicial:** conservar Next.js App Router, Server Components y navegación cliente, pero mover progresivamente cada pantalla a un componente/contenedor y ruta responsable de sus propios datos. Mantener compartidos el shell, sidebar, topbar y reproductor Twitch mediante layouts cuando sea técnicamente viable.
- **Análisis pendiente:**
  - Mapear vistas, rutas, props, estado global, efectos y dependencias de `HomePage`.
  - Medir tamaño de bundles y código/datos cargados innecesariamente por pantalla.
  - Identificar qué estado debe persistir entre rutas y cuál debe ser local.
  - Evaluar `layout.js`, rutas anidadas, Server Components, `Link`/router de Next.js y streaming/loading por ruta.
  - Revisar cómo preservar el `PersistentTwitchPlayer` durante la navegación sin remontajes, pausas ni pérdida del estado del iframe.
  - Confirmar compatibilidad con los dos dominios, permisos, acceso directo y navegación interna.
  - Comparar SPA clásica, SSR/MPA e implementación híbrida con RSC según UX, complejidad, rendimiento y migración.
  - Diseñar una migración gradual, sin reescritura completa y con posibilidad de revertir cada etapa.
- **Resultado esperado:** documento de decisión arquitectónica con métricas, propuesta recomendada, etapas, riesgos, archivos afectados y estrategia de verificación antes de modificar la estructura global.

### Notificación manual de resubidos

- **Estado:** En implementación en `feature/notify-resubido`.
- **Alcance actual:** acción con confirmación desde el rastreador y su mantenedor, permisos separados por pantalla, notificación pública realtime, reenvío explícito, auditoría y marca `Live.notifiedAt`.
- **Persistencia:** migración `20260623120000_add_live_notified_at`; la creación de la notificación y la actualización de `notifiedAt` se ejecutan en una única transacción PostgreSQL, con protección de 10 segundos frente a envíos concurrentes.
- **Pendiente operativo:** aplicar la migración versionada en los entornos correspondientes antes de desplegar la feature.

## Pendiente

### Player Twitch — pausa al abrir el centro de notificaciones

- **Problema:** Al abrir el centro de notificaciones en `/inicio`, el video del player de Twitch se pausa brevemente y luego se reanuda solo. El chat no se pausa (usa un `<iframe>` independiente sin SDK).
- **Causa probable:** El SDK de Twitch (`player.twitch.tv/js/embed/v1.js`) registra un listener de `click` en `document` y pausa el player cuando detecta un click fuera de su iframe. No hay forma de confirmarlo sin acceso al código fuente del SDK.
- **Lo que se intentó:**
  - Eliminar `visibility: hidden` del bloque CSS `body.is-notification-center-open` (solo aplicaba a ≤900px; no era la causa en desktop).
  - Agregar listener `Twitch.Player.PAUSE` que llama `player.play()` al detectar la pausa — reduce el tiempo de freeze pero no lo elimina.
  - Agregar listener `click` en `document` con `stopImmediatePropagation()` cuando el click viene de `.notification-center`, para bloquear el SDK antes de que vea el evento — el player sigue pausando (probablemente el SDK también escucha `pointerdown` u otro evento).
- **Pendiente:** Identificar qué evento exacto usa el SDK para detectar clicks fuera del player (podría ser `pointerdown`, `mousedown`, o `click` en capture phase), y usar el mismo mecanismo para bloquearlo. Alternativa: proxy del método `pause()` del player para ignorar llamadas no iniciadas por el usuario.
- **Estado:** Diferido (2026-06-23). El PAUSE listener ya en producción garantiza recuperación rápida.
- **Archivos involucrados:** `components/PersistentTwitchPlayer.js`, `app/globals.css`

### Player Twitch — transición full→mini

- **Problema:** Al navegar de `/inicio` al mini player, el reproductor se pausa brevemente.
- **Causa conocida:** El efecto `schedulePlaybackResume` tiene `routeMode` como dependencia, lo que causa una doble llamada a `play()` durante la transición.
- **Estado:** Diferido por el usuario (2026-05-19). El resto de mejoras (keep-alive, CSS scale transition, `isPlayerOnline`) ya están aplicadas.
- **Archivo:** `components/PersistentTwitchPlayer.js`

### ~~Merge dev → main (v2.0.0 a producción)~~

- Completado 2026-05-20.

### Feature: Estadísticas del archivo

- **Qué es:** página pública con métricas del archivo de directos — total de directos, directos por año, directos por categoría/tag, racha más larga de días consecutivos.
- **Decisiones tomadas:**
  - Sin cambios de schema — todos los datos ya están en BD (`Live.date`, `Live.year`, `LiveTag → Tag → TagCategory`)
  - "Total de horas" descartado — no hay campo de duración en BD ni en `additionalInfo`
  - Racha más larga: cargar fechas y calcular en JS (o window function en Postgres)
- **Archivos a crear/modificar:**
  - `lib/repositories/liveRepository.js` — agregar `getLiveStats()`
  - `app/rastreador/estadisticas/page.js` — Server Component, pública
  - `app/rastreador/estadisticas/loading.js` — exportar `AppShellLoading`
  - `components/` — tarjetas de stat y tabla por año si aplica
- **Pasos pendientes:** desde el inicio (paso 1 del checklist — repositorio)
- **Motivo del diferimiento:** prioridad baja, retomar cuando se decida.

### ~~Feature: Chulopuntos — sistema de calificación por anime~~

- Completado 2026-05-20. Schema (`AnimeRating` con `scoreTenths` para soportar decimales), migraciones `20260521022519_add_anime_rating` y `20260521093000_store_anime_rating_tenths`, repositorio, API `/api/anime-rating`, páginas Viendo/Terminados, `ChulopuntoGauge` SVG overlay, modal con slider/input decimal 1.0-8.0 y accesos rápidos, CSS.
- Pendiente: crear rol `streamer` en panel admin y asignarle permiso `anime.rating.streamer` para que su nota aparezca en los cards.

### ~~Feature: Historial de administración~~

- Completado 2026-05-21. Schema (`AuditLog`), migración `20260521120000_add_audit_logs`, repositorio, API `/api/audit-logs` y modal reutilizable de historial.
- Mantenedores auditados: usuarios, roles, rastreador, tags, anime viendo y anime terminados.
- Pendiente operativo: ejecutar migración Prisma antes de probar en PostgreSQL local/productivo.

### Feature: Perfil público `/u/[login]`

- **Qué es:** Página pública por usuario en `/u/[login]` con su lista de anime (agrupada por want/watching/completed + favoritos) y directos guardados. Cultura de compartir listas al estilo AniList/MAL.
- **Decisiones tomadas:**
  - URL slug: `login` (ya único y URL-safe)
  - Privacidad: opt-in — `isProfilePublic Boolean @default(false)` nuevo en `PlatformUser`
  - Acceso: abierto, sin login requerido. Si el perfil es privado → 404/mensaje.
  - No mostrar entradas con `isHidden: true`
- **Archivos a crear/modificar:**
  - `prisma/schema.prisma` — agregar `isProfilePublic Boolean @default(false)` a `PlatformUser`
  - `prisma/migrations/20260520120000_add_profile_public/` — nueva migración
  - `lib/repositories/platformUserRepository.js` — `compactUser` + `updateCurrentUserProfile` incluyen `isProfilePublic`; agregar `getPlatformUserByLogin(login)`
  - `lib/repositories/publicProfileRepository.js` *(nuevo)* — `getPublicProfile(login)` con anime y lives enriquecidos
  - `app/api/profile/route.js` — pasar `isProfilePublic` en la acción `profile`
  - `components/ProfileSettingsPage.js` — toggle "Perfil público" + link a `/u/[login]`
  - `app/u/[login]/page.js` *(nuevo)* — Server Component sin auth
  - `app/u/[login]/loading.js` *(nuevo)* — exportar `AppShellLoading`
  - `components/PublicProfilePage.js` *(nuevo)* — Client Component: header (avatar, alias, miembro desde), anime por sección, directos guardados
- **Pasos pendientes:** desde el inicio (paso 1 del checklist — schema)
- **Motivo del diferimiento:** diferido por el usuario (2026-05-20).

### ~~Feature: Centro de notificaciones persistente~~

- **Qué es:** Centro de notificaciones en la barra superior, inspirado en el dropdown de Metronic: botón con icono y badge de no leídas, panel desplegable con header, tabs por tipo, listado de eventos y acciones rápidas. Debe ser un sistema persistente real, no solo notificaciones derivadas en cliente.
- **Estado:** Implementado en la rama `feature/notification-center` (2026-06-21): schema, migración, repositorio, API `/api/notifications`, WebSocket `/api/notifications/ws`, componente `NotificationCenter`, integración en topbar y eventos productores iniciales, incluyendo detección de nuevos videos de YouTube con línea base silenciosa.
- **Objetivo funcional:** Informar al usuario sobre eventos relevantes de la plataforma y permitir leer, descartar y navegar al recurso asociado desde cualquier pantalla principal.
- **Decisiones tomadas:**
  - Implementar directamente con PostgreSQL/Prisma y estado de lectura por usuario.
  - Integrar el botón en `topbar-actions`, antes de `AccountMenu`, para reutilizarlo en `HomePage` y en detalles de directo.
  - Adaptar la referencia visual a la línea actual del proyecto: oscuro, bordes sutiles, acentos morado/verde/cian, radios moderados y sin copiar el azul claro de Metronic.
  - Usar `lucide-react` para iconos (`Bell`, `BellRing`, `Radio`, `Youtube`, `Tv`, `BookOpen`, `Sparkles`, `ShieldAlert`, `CheckCheck`) en vez de sumar Line Awesome.
  - Mantener pestañas iniciales: `Alertas`, `Actividad`, `Sistema`.
  - Las notificaciones deben soportar audiencias por alcance: todos, autenticados, administradores, permiso específico o usuario específico.
  - Usuarios invitados pueden ver notificaciones públicas si se decide mostrarlas, pero no deberían tener estado persistente de lectura salvo cookie/local fallback. En primera versión se puede ocultar el centro para invitados o mostrar solo CTA de login.
  - `Dios` entra por regla general de permisos; no requiere excepción especial.
- **Eventos sugeridos para primera versión:**
  - Nuevo directo agregado o actualizado en el rastreador.
  - Directo en vivo detectado por Twitch/EventSub.
  - Nuevo video de YouTube disponible, detectado por `/api/youtube/videos` y persistido en `YoutubeVideo`.
  - Nueva entrada de `/novedades` o `/changelog`.
  - Anime agregado o actualizado en Viendo/Terminados.
  - Alertas administrativas: import SpaceDrum ejecutado, EventSub registrado, cambios relevantes auditados o fallos operativos si se decide registrarlos.
- **Schema sugerido:**
  - `PlatformNotification`
    - `id Int @id @default(autoincrement())`
    - `type String` — `alert`, `activity`, `system`
    - `severity String @default("info")` — `info`, `success`, `warning`, `danger`
    - `title String`
    - `body String?`
    - `href String?`
    - `icon String?`
    - `metadata Json?`
    - `audience String @default("authenticated")` — `all`, `authenticated`, `admin`, `permission:<code>`, `user:<id>`
    - `createdByUserId Int?`
    - `createdAt DateTime @default(now())`
    - `expiresAt DateTime?`
  - `PlatformUserNotification`
    - `id Int @id @default(autoincrement())`
    - `userId Int`
    - `notificationId Int`
    - `readAt DateTime?`
    - `dismissedAt DateTime?`
    - `createdAt DateTime @default(now())`
    - `@@unique([userId, notificationId])`
  - Índices recomendados: `PlatformNotification.createdAt`, `PlatformNotification.audience`, `PlatformUserNotification.userId/readAt/dismissedAt`.
- **Archivos a crear/modificar:**
  - `prisma/schema.prisma` — agregar modelos e índices.
  - `prisma/migrations/YYYYMMDDHHMMSS_add_platform_notifications/` — migración versionada.
  - `lib/repositories/notificationRepository.js` *(nuevo)* — listar visibles por usuario, contar no leídas, marcar leída, marcar todas, descartar, crear notificación.
  - `app/api/notifications/route.js` *(nuevo)* — `GET` listado/contador, `POST` marcar leída/todas/descartar según acción.
  - `components/NotificationCenter.js` *(nuevo)* — botón, badge, popover, tabs, estados vacío/cargando/error.
  - `components/TopbarActions.js` *(opcional)* — factorizar `NotificationCenter + AccountMenu` para evitar duplicación.
  - `components/HomePage.js` — insertar centro en `topbar-actions`.
  - `components/DetailTopbarActions.js` — insertar centro en detalle de directo.
  - `app/globals.css` — estilos del botón/panel junto a `account-menu`, responsive mobile y z-index.
  - APIs existentes que generen eventos:
    - `app/api/update/route.js`
    - `app/api/anime-library/route.js`
    - `app/api/twitch/eventsub/route.js`
    - `app/api/twitch/archive/route.js`
    - `app/api/admin/spacedrum/import/route.js`
    - otros route handlers si se agregan eventos.
  - `docs/project-overview.md` — documentar modelos/rutas/permisos si aplica.
  - `docs/design-system.md` — documentar patrón visual del centro de notificaciones.
- **API sugerida:**
  - `GET /api/notifications?limit=20` → `{ notifications, unreadCount }`
  - `POST /api/notifications` con `{ action: "mark-read", id }`
  - `POST /api/notifications` con `{ action: "mark-all-read" }`
  - `POST /api/notifications` con `{ action: "dismiss", id }`
  - Responder JSON estructurado y status HTTP claro.
- **Reglas de permisos/audiencia:**
  - `audience = "all"` visible para todos.
  - `audience = "authenticated"` visible solo con sesión.
  - `audience = "admin"` visible para usuarios con `canAdmin` o permisos administrativos.
  - `audience = "permission:<code>"` visible si `can(user, code)`.
  - `audience = "user:<id>"` visible solo para ese usuario.
  - No exponer datos sensibles en `title`, `body`, `metadata` ni rutas.
- **UI/UX esperado:**
  - Badge compacto con número de no leídas; usar `99+` si supera 99.
  - Panel ancho en desktop, alineado a la derecha, con máximo alto y scroll interno.
  - En mobile, panel centrado o pegado al viewport con `width: calc(100vw - 1.5rem)` y sin overflow horizontal global.
  - Tabs con conteo por sección si es barato de calcular.
  - Cada item debe tener icono, título, texto corto, tiempo relativo determinístico en cliente, estado no leído y link opcional.
  - Acciones: click del item navega a `href` y marca como leído; botón `Marcar todo como leído`; botón de descartar si no compite visualmente.
  - Estados vacíos por tab: mensaje breve, sin página explicativa.
  - Cerrar al hacer click fuera y con Escape.
- **Consideraciones técnicas:**
  - Tiempo real implementado con WebSocket en `server.mjs`. El polling suave cada 30 segundos queda como respaldo cuando el canal no esté disponible.
  - Si se crean notificaciones desde acciones administrativas, la creación no debe romper la operación principal si falla.
  - Evitar duplicados con una clave en `metadata` o helper específico cuando un evento pueda dispararse varias veces.
  - Si un evento deriva de `AuditLog`, evaluar si conviene generar notificación explícita al mismo tiempo en vez de leer desde logs.
  - Mantener soporte JSON/Postgres del resto de entidades; este sistema puede requerir Postgres para persistencia real. Definir fallback seguro para `DATA_SOURCE=json` antes de implementar: ocultar el centro, devolver lista vacía o usar storage local solo en desarrollo.
- **Verificación mínima:**
  - `npm run db:migrate`
  - `npm run db:generate`
  - `npm run build`
  - Probar usuario autenticado común, rol admin/Dios e invitado.
  - Probar contador, tabs, marcar una, marcar todas, descartar, navegación por `href` y estado vacío.
  - Playwright/screenshots en desktop y mobile del topbar con panel abierto.
  - Verificar que el panel no tape incoherentemente el menú de cuenta y que no haya overflow global.
- **Verificación aplicada:** `npm run db:generate`, `npm run build`, `git diff --check`.
- **Pendiente operativo:** aplicar las migraciones `20260621180000_add_platform_notifications` y `20260621193000_add_youtube_video_notifications` en PostgreSQL local/QA/producción con `npm run db:migrate:deploy`. La validación local con `npm run db:migrate` no pudo completarse porque Prisma devolvió `Schema engine error` sin detalle en el entorno actual.

## Ideas / Mejoras futuras

### Trivia otaku

- **Qué es:** módulo de trivia de anime con preguntas por título, género, temporada o dificultad, orientado a juego semanal y ranking social.
- **Ideas iniciales:** preguntas de opción múltiple, rachas, tabla semanal/mensual, historial de aciertos y badges por hitos.
- **Integración posible:** usar títulos ya presentes en la biblioteca de anime como base; enlazar preguntas a `AnimeEntry` cuando corresponda.
- **Permisos sugeridos:** vista pública o para usuarios autenticados; administración de preguntas con permiso nuevo tipo `admin.anime.trivia`.
- **Riesgos/decisiones pendientes:** evitar spoilers por episodio o permitir marcar preguntas con rango de episodios; definir si las preguntas son manuales, importadas o generadas con revisión.

### Perfil otaku público

- **Qué es:** evolución visual/social del perfil público `/u/[login]`, con una tarjeta otaku compartible que resuma identidad y gustos de anime.
- **Ideas iniciales:** anime favorito, opening/ending favorito, género más visto, nota promedio, cantidad de completados, racha de capítulos, títulos/badges desbloqueados y listas destacadas.
- **Relación con backlog existente:** se apoya en la feature pendiente `Perfil público /u/[login]`; primero conviene implementar privacidad, datos base y página pública.
- **Privacidad:** todo dato exhibido debe ser opt-in y configurable desde perfil.
- **Riesgos/decisiones pendientes:** decidir si campos como waifu/husbando existen, si se permiten textos libres moderables y si habrá imagen/tarjeta para compartir.

### Mantenedor de novedades

- La primera versión de `/novedades` y `/changelog` usa contenido estático versionado en el repositorio.
- Evolución futura: crear un mantenedor administrativo para publicar novedades, marcar cambios como destacados, definir audiencia, programar fechas y registrar auditoría.
- Agregar CRUD administrativo para novedades/changelog, idealmente con permisos separados para ver, crear, editar, publicar y eliminar.
- Permitir marcar novedades como leídas por usuario y mostrar un badge en el menú cuando existan novedades pendientes.
- Agregar métricas de vistas e interacción: aperturas de página, clicks en CTAs, módulos más consultados y novedades más vistas.
- Evaluar notificaciones internas o avisos suaves cuando haya novedades importantes.
- Generar parcial o totalmente el changelog desde tags/releases de Git, manteniendo posibilidad de editar el texto visible para usuarios.
- Explorar un editor Markdown o contenido enriquecido para novedades largas, sin convertir la página pública en un manual pesado.
- Agregar tutoriales interactivos/contextuales por módulo como evolución de las guías rápidas actuales.

### Doble polling de Twitch status

- `HomeDashboard` y `PersistentTwitchPlayer` hacen fetch a `/api/twitch/status` de forma independiente cada 60 segundos.
- Impacto actual: duplica solicitudes HTTP internas, aunque la caché de 30 segundos y el refresco compartido evitan repetir llamadas externas a Twitch.
- Pendiente: centralizar el estado en un proveedor común después de validar que no se afecten el dashboard ni el player persistente.
- Approach sugerido: compartir el estado via React Context o subir el fetch al Server Component y pasarlo como prop inicial, dejando solo un poller activo.

### Revalidación periódica de membresía Twitch

- Actualmente Tier, moderación y VIP se vuelven a consultar cuando el usuario inicia sesión o conecta Twitch; una sesión persistente no dispara sincronización en segundo plano.
- Diseñar por separado una política de revalidación basada en `twitchRoleSyncedAt`, sin mezclar tokens OAuth de usuarios con la caché pública de `/api/twitch/status`.
- Opción preferida para analizar: solicitar una nueva autenticación Twitch cuando la sincronización supere el plazo definido, evitando almacenar refresh tokens de usuarios sin una estrategia de cifrado y rotación.

### Refactor de HomePage.js

- `components/HomePage.js` tiene ~1500 líneas y maneja 10+ vistas distintas (home, tracker, mi lista, anime, admin, spacedrum), todo el estado global, filtros, permisos y fetches.
- Impacto: difícil de mantener, todo el código se carga para todos los usuarios.
- Approach sugerido: separar cada vista en su propio componente contenedor con su estado local, y dejar `HomePage.js` solo como shell de navegación.
