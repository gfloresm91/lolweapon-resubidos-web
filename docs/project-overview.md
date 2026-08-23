# Project Overview

Archivo VOD y biblioteca de anime para el streamer Lolweapon. Sirve dos dominios desde la misma app Next.js: `resubidos.lolweapon.com` (tracker de directos) y `viendo.lolweapon.com` (biblioteca de anime).

**Repositorio GitHub:** `gfloresm91/lolweapon-resubidos-web` — **público**. Nunca commitear credenciales, IPs del servidor, tokens, ni datos de usuarios. El `.env` está en `.gitignore` y nunca debe subirse.

---

## APIs integradas

### Twitch

**Archivo:** `lib/twitch.js`, `lib/twitchOAuth.js`

| Endpoint | Uso |
|---|---|
| `POST /oauth2/token` | Intercambio de tokens |
| `GET /helix/users` | Perfil del usuario |
| `GET /helix/subscriptions/user` | Tier de suscripción al canal |
| `GET /helix/moderation/channels` | Estado de moderador |
| `GET /helix/channels/vips` | Estado de VIP |
| `GET /helix/streams` | Stream en directo (estado, título, viewers, categoría) |
| `GET /helix/channels` | Info del canal (título, categoría offline) |
| `GET /helix/games` | Info del juego (box art) |
| `POST /helix/eventsub/subscriptions` | Registro de webhooks `stream.online` y `stream.offline` |

**Variables de entorno requeridas:**
```
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TWITCH_BROADCASTER_LOGIN
TWITCH_BROADCASTER_ACCESS_TOKEN
TWITCH_EVENTSUB_SECRET
TWITCH_EVENTSUB_CALLBACK_URL
TWITCH_AUTH_REDIRECT_URI
TWITCH_ARCHIVE_TIME_ZONE
TWITCH_REQUIRE_ACTIVE_STREAM
```

`NEXT_PUBLIC_TWITCH_EMBED_LOGIN` es un override opcional exclusivo para pruebas del player, chat, enlaces y estado público de Inicio. Si queda vacío, esas superficies usan `TWITCH_BROADCASTER_LOGIN`. No sustituye el broadcaster oficial de OAuth, EventSub ni archivado.

---

### YouTube

**Archivo:** `lib/youtube.js`
**Sincronización local:** `lib/repositories/youtubeVideoRepository.js`

| Endpoint | Uso |
|---|---|
| `GET /youtube/v3/channels` | Obtener playlist de uploads del canal |
| `GET /youtube/v3/playlistItems` | Últimos N videos (default: 10) |

**Datos devueltos por video:** `id`, `title`, `publishedAt`, `thumbnail`, `url`

No retorna duración ni views (requeriría llamada extra a `/videos` con `contentDetails`/`statistics` — costo adicional de cuota).

`server.mjs` ejecuta un sincronizador en background para detectar nuevos videos aunque ningún usuario visite `/inicio`. El intervalo se controla con `YOUTUBE_NOTIFICATION_SYNC_INTERVAL_MS` y puede desactivarse con `YOUTUBE_NOTIFICATION_SYNC_ENABLED=false`. Cuando `DATA_SOURCE=postgres`, el sistema guarda IDs en `YoutubeVideo`: la primera sincronización crea una línea base silenciosa para evitar notificaciones antiguas; los videos nuevos posteriores crean una notificación `Alerta` pública y se empujan por WebSocket. `/api/youtube/videos` no escribe en PostgreSQL: obtiene los videos para Inicio mediante una caché de proceso de 15 minutos, deduplica refrescos concurrentes, conserva el último resultado válido durante una hora y publica cabeceras de caché CDN.

**Variables de entorno requeridas:**
```
YOUTUBE_API_KEY
YOUTUBE_CHANNEL_ID
YOUTUBE_CHANNEL_URL
YOUTUBE_UPLOADS_PLAYLIST_ID
YOUTUBE_NOTIFICATION_SYNC_ENABLED
YOUTUBE_NOTIFICATION_SYNC_INTERVAL_MS
```

---

### AniList

**Archivo:** `app/api/anime-library/anilist/route.js`

**Endpoint:** `https://graphql.anilist.co` — sin autenticación, sin variables de entorno.

**Queries:**
- `SearchAnimeById($id: Int)` — buscar por ID
- `SearchAnime($search: String)` — buscar por título

**Datos obtenidos:** título (romaji, english, native), descripción, formato (TV/Movie/OVA…), estado de emisión, episodios, año, imagen de portada, URL de AniList.

### Calendario de temporada

El calendario semanal combina dos fuentes:

- AnimeSchedule v3 entrega emisiones subtituladas concretas, retrasos, plataformas y enlaces.
- AniList completa títulos, portada, descripción, formato, episodios, contenido adulto, país de origen, trailer y tags (filtrados de spoilers, top 8 por rank).

La sincronización se ejecuta manualmente desde Administración, muestra una previsualización antes de aplicar y conserva los overrides editoriales. Los horarios se almacenan en UTC y el navegador los presenta en la zona horaria detectada o elegida por el usuario.

Cada card de emisión tiene un botón de favorito (marcador) en la esquina superior derecha. Requiere sesión (toast con acción "Iniciar sesión" para invitados, sin redirección inmediata) y persiste en `PlatformUserSeasonalAnimeFavorite` por `aniListId`. La vista de filtro "todos / solo favoritos" queda pendiente en `docs/backlog.md`.

El poster de cada card abre `SeasonalAnimeDetailModal`: trailer embebido de YouTube/Dailymotion (o el poster con "Sin trailer disponible" si no hay), título, formato/episodios/estado, tags, sinopsis con "Ver más", plataformas de streaming, link a AniList y el botón de favorito. Los chips de plataforma/AniList se comparten entre la card y el modal vía `components/SeasonalAnimePlatformChip.js` y `lib/animeCalendarPlatforms.js`.

Variables:

```env
ANIME_SCHEDULE_API_TOKEN=
ANIME_SCHEDULE_API_BASE_URL=https://animeschedule.net/api/v3
NEXT_PUBLIC_ANIME_CALENDAR_DEFAULT_TIME_ZONE=America/Santiago
```

---

### Tier List de temporada

Dos tableros tipo tiermaker, independientes del Calendario de temporada (no comparten datos con `SeasonalAnime`, solo la dimensión `AnimeSeason`):

- **Animes** (`/biblioteca-anime/tier-list/animes`): roster sincronizado directo desde la query nativa de temporada de AniList (`Page(media(season, seasonYear))`), sin AnimeSchedule.
- **Openings/Endings** (`/biblioteca-anime/tier-list/openings`): un mismo URL con toggle interno OP/ED (dos tableros independientes). Sincronizado desde AnimeThemes.moe (`https://graphql.animethemes.moe/`, `findAnimeByExternalSite(site: ANILIST, id: [...])`) para los animes ya cargados en el Tier List de esa temporada — requiere sincronizar Animes primero. Cada tema resuelve un solo video: prioriza la entry sin spoiler/nsfw y, dentro de ella, la mayor resolución (empate: fuente `BD` sobre `WEB`). Si solo hay entries con spoiler, se guarda igual (`isSpoiler: true`) y el front lo oculta por defecto.

Cada usuario autenticado arma y guarda su propio tablero por temporada y tipo (`PlatformUserAnimeTierList`), con filas personalizables (nombre, color, orden) y autosave con debounce. Invitados pueden armar el tablero libremente (permiso `anime.tierlist.*.view` asignado por defecto a `invitado`, a diferencia del Calendario), pero no se guarda hasta iniciar sesión. Un anime u opening ya rankeado que el admin oculte o elimine se mantiene en el tablero del usuario marcado como "oculto por administración", pero deja de ofrecerse a usuarios nuevos.

Compartir: exportar el tablero como imagen (`html-to-image`, client-side) o publicar un link de solo lectura (`isPublic` + `shareToken` opaco) en `/biblioteca-anime/tier-list/compartido/[shareToken]` — página standalone sin el shell de `HomePage`, pensada para compartirse fuera del sitio.

Drag & drop implementado con `@dnd-kit/core` + `@dnd-kit/sortable` (soporte táctil).

Administración con CRUD completo (crear, editar, ocultar/eliminar lógicamente, restaurar) en dos mantenedores independientes, cada uno con su propio sync preview/apply:

- `/administracion/biblioteca-anime/tier-list-animes` — permisos `admin.anime.tierlist.animes.view/sync/create/update/delete`.
- `/administracion/biblioteca-anime/openings` — permisos `admin.anime.tierlist.openings.view/sync/create/update/delete`.

Variables:

```env
ANIME_THEMES_API_BASE_URL=https://graphql.animethemes.moe/
```

---

## Modelos de datos (Prisma)

### Anime

| Modelo | Descripción |
|---|---|
| `Anime` | Catálogo (key, title, titleEs, image, description, year, episodes, formatId, releaseStatusId) |
| `AnimeLibraryEntry` | Estado de la entrada (watchStatusId, currentEpisode, purchasedEpisodes, isFullSeason, libraryEnabled) |
| `AnimeExternalReference` | Links externos por proveedor (AniList, etc.) |
| `ExternalProvider` | Proveedores externos (code, name, baseUrl) |
| `AnimeFormat` | TV, Movie, OVA, etc. |
| `AnimeReleaseStatus` | Finished, Airing, etc. |
| `AnimeWatchStatus` | pending, tracking, completed, paused, purchased, dropped |
| `AnimeSeason` | Temporada importada, estado activo/borrador/archivado y última sincronización |
| `SeasonalAnime` | Snapshot de metadata AniList por temporada (incluye trailer y tags) y overrides editoriales |
| `SeasonalAnimeAiring` | Emisión subtitulada concreta, horario UTC, plataforma y overrides |
| `SeasonalAnimeSync` | Historial técnico de sincronizaciones remotas |
| `PlatformUserSeasonalAnimeFavorite` | Animes de temporada marcados como favoritos por usuario, referenciados por `aniListId` (estable entre temporadas) |
| `AnimeTierListEntry` | Roster de animes de temporada para el Tier List, independiente de `SeasonalAnime`: sincronizado directo desde AniList (sin AnimeSchedule) o creado manualmente por un admin |
| `AnimeTierListTheme` | Opening/ending por anime del Tier List, sincronizado desde AnimeThemes.moe o creado manualmente; `type`/`sequence` efectivos consideran overrides manuales. Las altas manuales usan `createRequestKey` único para que reintentos o doble clic no dupliquen el tema. |
| `PlatformUserAnimeTierList` | Tablero guardado por usuario, por temporada y por tipo (`animes`, `op`, `ed`); soporta compartir vía `isPublic`/`shareToken` |
| `PlatformUserAnimeTier` | Fila personalizada del tablero (nombre, color, orden) |
| `PlatformUserAnimeTierPlacement` | Colocación de un item (`AnimeTierListEntry` o `AnimeTierListTheme`) en una fila o en "Sin rankear" |

### Directos

| Modelo | Descripción |
|---|---|
| `Live` | Directo (legacyId, title, date, year, statusId, image, additionalInfo, notifiedAt) |
| `LiveStatus` | En directo, Completo, Pendiente, Lost Media, Subiendo, Incompleto |
| `LiveTag` | Relación many-to-many Live ↔ Tag |
| `LiveLink` | Links por plataforma (telegram, okru, patreon, piero…) |
| `LinkPlatform` | Plataformas de links disponibles |

### Usuarios y autenticación

| Modelo | Descripción |
|---|---|
| `PlatformUser` | Usuario (twitchUserId, login, alias, email, avatarUrl, tier Twitch, roleId, isActive) |
| `PlatformAuthIdentity` | Identidades externas vinculadas a una cuenta canónica usando el subject estable del proveedor |
| `PlatformIdentityLinkAttempt` | Vinculación temporal cuando un proveedor usa un correo ya registrado y se requiere reautenticación |
| `PlatformRole` | Rol (code, label, canAdmin) |
| `PlatformPermission` | Permiso granular (code, label, group) |
| `PlatformRolePermission` | Relación rol ↔ permiso |
| `PlatformSession` | Sesión activa (token, expiresAt — 14 días) |
| `LoginAttempt` | Auditoría de intentos de login |
| `AuditLog` | Historial de acciones administrativas por mantenedor |
| `PlatformNotification` | Notificaciones persistentes por audiencia, origen y ciclo de publicación; soporta programación, expiración, activación y eliminación lógica |
| `StreamAudienceSession` | Resumen agregado de audiencia web por directo Twitch: promedio, pico, minutos-persona, estado y metadatos del stream |
| `StreamAudienceSample` | Muestra por minuto de presencia concurrente en Inicio y audiencia oficial informada por Twitch |
| `PlatformUserNotification` | Estado por usuario de lectura y descarte de notificaciones |
| `YoutubeVideo` | Videos de YouTube ya detectados para evitar notificaciones duplicadas |
| `SupportTicket` | Sugerencias/reclamos creados por usuarios registrados, con tipo, asunto, estado y última actividad |
| `SupportTicketMessage` | Mensajes de la conversación del ticket, escritos por usuario o administración |
| `PlatformMobileRefreshToken` | Refresh token de apps nativas (Lolweapon+), 60 días deslizante, agrupado por `familyId` para rotación con detección de reuso |
| `PlatformMobileAccessToken` | Access token de apps nativas, 15 minutos, ligado a la `familyId` de su refresh token |
| `PlatformMobileOAuthExchange` | Código de un solo uso (60 segundos) que puentea el callback OAuth web con el canje final de tokens móviles de la app |

### Actividad del usuario

| Modelo | Descripción |
|---|---|
| `PlatformUserAnime` | Favorito, listStatus, isHidden por anime |
| `AnimeRating` | Puntuación personal por anime en décimas (`scoreTenths`) |
| `PlatformUserLive` | isSaved, isWatched por directo |

### Historial administrativo

Los mantenedores del módulo Administración registran acciones en `AuditLog`: usuario actor, fecha, módulo, tipo de registro, ID/etiqueta, resumen y snapshots `before`/`after` sanitizados. La API `/api/audit-logs` expone el historial filtrable por módulo para usuarios con permisos de administración relacionados.

Módulos auditados:
- `admin.users`
- `admin.roles`
- `admin.tracker`
- `admin.tags`
- `admin.anime.tracking`
- `admin.anime.completed`

Antes de desplegar cambios que incluyan auditoría, aplicar la migración Prisma que crea la tabla `AuditLog`.

### Centro de notificaciones

El topbar incluye un centro de notificaciones persistente para usuarios autenticados. El panel muestra badge de no leídas, tabs `Alertas`, `Actividad` y `Sistema`, acciones para marcar como leído o descartar, y enlaces directos al recurso afectado.

Las notificaciones se guardan en `PlatformNotification` y el estado individual en `PlatformUserNotification`. La API `/api/notifications` lista notificaciones visibles para el usuario actual y permite marcar una, marcar todas o descartar. Si `DATA_SOURCE` no es `postgres`, el repositorio devuelve lista vacía.

El tiempo real usa WebSocket en `/api/notifications/ws`, servido por `server.mjs` en el mismo puerto de Next.js. Cuando se crea una notificación, el servidor emite `notifications:update` y el cliente refresca el panel. El polling queda exclusivamente como respaldo cuando el WebSocket no está conectado, con una cadencia de dos minutos; la reconexión usa backoff exponencial con jitter para evitar estampidas. El servidor envía ping cada 30 segundos y termina conexiones que no responden. La presencia concurrente de Inicio usa un canal independiente en `/api/presence/ws` para no mezclar sus mensajes con notificaciones o tickets.

La inicialización idempotente de roles y permisos se comparte entre solicitudes y se ejecuta una sola vez por proceso. Nunca debe repetirse la secuencia completa de `upsert` por cada invitado o consulta de notificaciones. La campana obtiene lista y conteo de no leídas desde una sola lectura de notificaciones visibles.

`server.mjs` toma una muestra de audiencia cada minuto mientras el broadcaster oficial está online. Guarda únicamente agregados en PostgreSQL: presencia web concurrente y `viewer_count` oficial de Twitch, agrupados por `twitchStreamId`. Los fallos de Twitch o de persistencia se registran sin cerrar una sesión válida ni afectar Inicio. `STREAM_AUDIENCE_ANALYTICS_ENABLED=false` permite desactivar el agregador; con una fuente distinta de PostgreSQL queda desactivado automáticamente.

La campana, protegida por `notifications.view`, muestra avisos rápidos y permite a invitados consultar únicamente notificaciones públicas; su estado leído/descartado se conserva en `localStorage`. La página `/notificaciones`, protegida separadamente por `notifications.full.view`, permite a usuarios autenticados buscar, filtrar, marcar como leída/no leída, descartar y restaurar. El mantenedor `/administracion/notificaciones` gestiona notificaciones manuales y automáticas, incluyendo publicación inmediata o programada. `server.mjs` revisa publicaciones pendientes cada 30 segundos, fija `publishedAt` una sola vez y emite la actualización WebSocket.

Los invitados solo reciben notificaciones con `audience: all`. Como no tienen `PlatformUser.id`, su estado de leído/descartado se guarda en `localStorage`; los usuarios autenticados usan `PlatformUserNotification`.

`server.mjs` también sincroniza notificaciones de contenido estático al arrancar mediante claves únicas (`dedupeKey`) para novedades/changelog, evitando duplicados cuando el proceso reinicia.

Productores implementados:
- Nuevo directo creado en el rastreador.
- Aviso manual de resubido disponible, con reenvío explícito y audiencia pública.
- Directo online detectado por Twitch EventSub.
- Nuevo anime agregado a biblioteca.
- Importación remota de SpaceDrum completada.
- Nuevo video de YouTube detectado por el sincronizador de `server.mjs` después de la línea base inicial.
- Nueva comunicación pública de `/novedades`.
- Nueva comunicación pública de `/changelog`.
- Nuevo ticket de sugerencia/reclamo para usuarios con `admin.tickets.view`.
- Respuesta o cierre de ticket para el usuario creador.

Tipos iniciales:
- `Alertas`: emisiones en vivo y publicaciones nuevas externas relevantes para la comunidad, como Twitch online o nuevo video de YouTube.
- `Actividad`: contenido agregado o gestionado dentro de la plataforma, como nuevos directos del rastreador, nuevos animes o actualización de changelog.
- `Sistema`: procesos operativos o administrativos, como importaciones SpaceDrum.

Las alertas con `href` se abren en una pestaña nueva para no sacar al usuario de la pantalla actual. Actividad y sistema navegan en la misma pestaña.

Audiencias soportadas:
- `all`
- `authenticated`
- `admin`
- `permission:<code>`
- `user:<id>`

### SpaceDrum

| Modelo | Descripción |
|---|---|
| `SpaceDrum` | Contenido principal por idioma (`spacedrum-es-es`, `spacedrum-en-us`) |
| `SpaceDrumChapter` | Capítulos/ciclos con fecha, idioma y resumen |
| `SpaceDrumPage` | Páginas de cada capítulo (imágenes) |
| `SpaceDrumMeta` / `SpaceDrumLink` | Metadatos y links asociados |

SpaceDrum se importa desde la web original usando endpoints JSON públicos:

- `https://www.mangaspacedrum.com/chapters?lan=es-es`
- `https://www.mangaspacedrum.com/chapters?lan=en-us`

El lector muestra selector de idioma, capítulos, URLs compartibles por idioma/capítulo y lectura vertical de páginas.

### Tags

| Modelo | Descripción |
|---|---|
| `Tag` | Etiqueta (name, slug, categoryId) |
| `TagCategory` | Categoría (code, label, icon, keywords, sortOrder) |

---

## Roles y permisos

### Roles predefinidos

| Código | Label | canAdmin | Descripción |
|---|---|---|---|
| `dios` | Dios | ✓ | Acceso total |
| `admin` | Admin | ✓ | Gestión completa |
| `moderador` | Moderador | ✓ | Edición de contenido |
| `tw-tier-3` | Tier 3 | — | Suscriptor Twitch Tier 3 |
| `tw-tier-2` | Tier 2 | — | Suscriptor Twitch Tier 2 |
| `tw-tier-1` | Tier 1 | — | Suscriptor Twitch Tier 1 |
| `tw-vip` | VIP | — | VIP en Twitch |
| `publico` | Público | — | Usuario registrado sin tier |
| `invitado` | Invitado | — | Sin autenticación |

La sincronización de rol Twitch ocurre automáticamente en cada login: moderador → `moderador`, Tier 3/2/1 → `tw-tier-3/2/1`, resto → `publico`. Por decisión operativa actual, los beneficios automáticos de la web solo consideran suscripciones pagadas de Twitch. Los roles `tw-vip` y `yt-miembro` no se pueden obtener ni entregar beneficios adicionales hasta que Kala autorice su activación (ja!).

### Permisos principales

| Grupo | Códigos |
|---|---|
| Plataforma: Inicio | `home.view` |
| Plataforma: Notificaciones | `notifications.view`, `notifications.full.view` |
| Plataforma: Sugerencias/Reclamos | `support.tickets.view`, `support.tickets.create` |
| Plataforma: RTFM | `rtfm.view` |
| Plataforma: Novedades | `news.view` |
| Plataforma: Historial de cambios | `changelog.view` |
| Archivo VOD: Rastreador | `tracker.view`, `tracker.create/update/delete`, `tracker.export/import`, `tracker.lives.notify`, `tracker.form.full/compact` |
| Archivo VOD: Calendario | `tracker.calendar.view` |
| Biblioteca de anime: Viendo | `anime.tracking.view/create/update/delete`, `anime.tracking.form.full/compact` |
| Biblioteca de anime: Terminados | `anime.completed.view/create/update/delete`, `anime.completed.form.full/compact` |
| Biblioteca de anime: Puntuación | `anime.rating.write`, `anime.rating.streamer` |
| Biblioteca de anime: Calendario | `anime.calendar.view` |
| Biblioteca de anime: Tier List | `anime.tierlist.animes.view`, `anime.tierlist.openings.view`, `anime.tierlist.openings.manage` (crear/editar/eliminar Openings/Endings desde el tablero; default `admin`, `moderador` y `streamer`) |
| Lecturas: SpaceDrum | `spacedrum.view` |
| Administración: Usuarios | `users.read`, `users.create`, `users.update`, `users.delete` |
| Administración: Roles | `roles.read`, `roles.create`, `roles.update` |
| Administración: Notificaciones | `admin.notifications.view/create/update/delete` |
| Administración: Audiencia web | `admin.audience.view` |
| Administración: Tickets | `admin.tickets.view/update` |
| Administración: Rastreador | `admin.tracker.view`, `admin.lives.notify` |
| Administración: Tags | `admin.tags.view`, `tags.create`, `tags.update`, `tags.delete` |
| Administración: Anime Viendo | `admin.anime.tracking.view` |
| Administración: Anime Terminados | `admin.anime.completed.view` |
| Administración: Calendario de anime | `admin.anime.calendar.view/sync/update` |
| Administración: Tier List de Animes | `admin.anime.tierlist.animes.view/sync/create/update/delete` |
| Administración: Tier List de Openings/Endings | `admin.anime.tierlist.openings.view/sync/create/update/delete` |

---

## Rutas y páginas

### Páginas

| Ruta | Descripción |
|---|---|
| `/inicio` | Home: stream en vivo, últimos directos y últimos videos de YouTube. `Twitch` es la vista predeterminada; `VK + Twitch` abre siempre un teatro de aplicación fijo de pantalla completa que bloquea el scroll exterior y conserva VK, Twitch y chat dentro del viewport. Al montar el teatro, Chrome móvil en Android y Safari/Chrome en iOS muestran encima una ayuda descartable para solicitar el sitio de escritorio, debido a la restricción móvil del embed de VK; la ayuda no modifica el layout del teatro y queda recuperable desde Información. Android admite temporalmente el override manual y opcional `stream=dual&layout=android`: el teatro se renderiza sobre un lienzo móvil escalado al viewport virtual de escritorio para conservar tamaños legibles, pero entrar al modo dual no agrega `layout` automáticamente. Los parámetros se eliminan al salir del teatro. Una sola instancia del SDK oficial de Twitch se mueve entre Inicio y el mini player; al entrar al teatro solicita reproducción durante el clic y después de montar el ancla, y `PAUSE` intenta reanudarla mientras la pestaña siga visible. `PLAYBACK_BLOCKED` habilita una acción manual. Salir o pulsar `Escape` vuelve a Twitch. VK conserva su fullscreen nativo y se desmonta al salir. Durante el directo se muestran por separado la audiencia oficial de Twitch y la presencia aproximada en esta página. |
| `/rtfm` | RTFM del archivo: origen de los resubidos, notas operativas, mapa de navegación con permisos por rol y enlaces principales. Controlado por permiso `rtfm.view` y asignado por defecto a todos los roles. |
| `/novedades` | Onboarding, beneficios por tipo de usuario, novedades recientes y tutoriales rápidos. Controlado por permiso `news.view` y asignado por defecto a todos los roles. |
| `/changelog` | Historial completo de versiones, mejoras y correcciones. Controlado por permiso `changelog.view` y asignado por defecto a todos los roles. |
| `/notificaciones` | Centro completo para usuarios autenticados con permiso `notifications.full.view` |
| `/sugerencias-reclamos` | Bandeja y formulario de tickets para usuarios registrados con `support.tickets.view` |
| `/sugerencias-reclamos/[id]` | Conversación del ticket propio, enlazada desde notificaciones de respuesta |
| `/rastreador` | Tracker: lista de todos los directos con filtros |
| `/rastreador/calendario` | Calendario histórico de directos por año, mes y día. Controlado por permiso `tracker.calendar.view`, asignado por defecto a tiers Twitch, miembros YouTube, moderación y administración. |
| `/rastreador/[id]` | Detalle de un directo: reproductor con fuentes Piero/OK.RU y partes independientes, enlaces externos Telegram/Patreon y actividad. Piero usa Vidstack sobre MP4, conserva localmente progreso, volumen, silencio y velocidad, permite continuar al volver, ofrece avance automático opcional, doble toque/clic lateral, atajos, feedback visual y controles accesibles para saltos de 10 segundos, velocidad, PiP y fullscreen. Detecta opcionalmente un WebVTT lateral con el mismo nombre base del MP4 y lo registra como pista de subtítulos en español. Su panel de subtítulos persiste tipografía, tamaño, colores, opacidades, fondo, ventana, borde y posición; aplica la apariencia localmente y sincroniza las equivalencias compatibles con `TextTrackStyle` durante Google Cast. Cuando el navegador y dispositivo lo permiten, ofrece un único control de reproducción remota que prioriza Google Cast y usa AirPlay como alternativa; el control se oculta si ninguno está disponible. Durante una transmisión remota reemplaza la superficie técnica del proveedor por un estado integrado con dispositivo, título, controles compatibles y acciones para detener o continuar localmente. El componente queda aislado para recibir HLS, calidades, poster, miniaturas y capítulos cuando el NAS publique esas fuentes. |
| `/biblioteca-anime/viendo` | Anime en seguimiento: temporada entera, caps comprados o pendientes de compra |
| `/biblioteca-anime/calendario` | Calendario semanal de emisiones subtituladas en la zona horaria del usuario |
| `/biblioteca-anime/tier-list/animes` | Tier List de animes de temporada (drag & drop, tiers personalizables). Controlado por `anime.tierlist.animes.view`, asignado por defecto a tiers Twitch, miembros YouTube, moderación, administración e invitados. |
| `/biblioteca-anime/tier-list/openings` | Tier List de openings/endings de temporada, con toggle interno OP/ED. Controlado por `anime.tierlist.openings.view`, misma asignación por defecto que Animes. |
| `/biblioteca-anime/tier-list/compartido/[shareToken]` | Vista pública de solo lectura de un tier list compartido, sin autenticación ni shell de `HomePage` |
| `/biblioteca-anime/terminados` | Anime terminado, pausado, pendiente o dropeado |
| `/mi-lista` | Lista personal del usuario (guardados, vistos, favoritos) |
| `/spacedrum` | Lector bilingüe de SpaceDrum, controlado por permiso `spacedrum.view` |
| `/login` | Login manual |
| `/registro` | Registro de usuario |
| `/perfil` | Perfil del usuario (avatar, datos) |
| `/administracion/...` | Panel de administración |
| `/administracion/biblioteca-anime/calendario` | Sincronización y overrides del Calendario de temporada |
| `/administracion/biblioteca-anime/tier-list-animes` | Mantenedor CRUD del roster de Animes del Tier List (sync AniList, crear/editar/eliminar/restaurar) |
| `/administracion/biblioteca-anime/openings` | Mantenedor CRUD de Openings/Endings del Tier List (sync AnimeThemes.moe, crear/editar/eliminar/restaurar) |
| `/administracion/notificaciones` | Mantenedor de notificaciones manuales y automáticas, protegido por permisos `admin.notifications.*` |
| `/administracion/tickets` | Mantenedor administrativo de sugerencias/reclamos, protegido por `admin.tickets.view` |
| `/administracion/audiencia` | Dashboard de solo lectura para presencia web concurrente, evolución por minuto, comparación con Twitch e historial por directo; requiere `admin.audience.view` |
| `/administracion/tickets/[id]` | Conversación administrativa del ticket, permite responder con `admin.tickets.update` |
| `/mobile-auth/registro` | Página puente para completar registro OAuth iniciado desde la app Lolweapon+, equivalente móvil de `/registro?oauth=...` |
| `/mobile-auth/vincular` | Página puente para completar vinculación OAuth iniciada desde la app Lolweapon+ |

### API Routes

| Ruta | Método | Descripción |
|---|---|---|
| `/api/login` | POST | Login manual |
| `/api/register` | POST | Registro |
| `/api/logout` | POST | Cerrar sesión |
| `/api/auth/session` | GET | Valida la cookie antes de mostrar login/registro; elimina automáticamente cookies huérfanas tras restores y conserva la cookie ante errores temporales de BD |
| `/api/notifications` | GET/POST | Centro de notificaciones: listar, marcar leído, marcar todo leído y descartar |
| `/api/admin/notifications` | GET/POST | Listado, creación, edición, programación, activación y eliminación lógica de notificaciones |
| `/api/notifications/ws` | WebSocket | Canal realtime para avisar a clientes que deben refrescar notificaciones |
| `/api/presence/ws` | WebSocket | Presencia concurrente aproximada en Inicio; deduplica navegadores, exige 15 segundos visibles, usa heartbeat cada 20 segundos y expira tras 40 segundos sin actividad. Las actualizaciones se agrupan durante 500 ms, solo se emiten cuando cambia el total efectivo y las conexiones con más de 256 KB pendientes se descartan para proteger memoria y event loop. |
| `/api/support-tickets` | GET/POST | Lista tickets propios y crea sugerencias/reclamos |
| `/api/support-tickets/[id]` | GET | Detalle de ticket propio |
| `/api/support-tickets/[id]/messages` | POST | Agrega mensaje del usuario al ticket |
| `/api/admin/tickets` | GET | Listado administrativo paginado de tickets |
| `/api/admin/tickets/[id]` | GET/PATCH | Detalle administrativo y cambio de estado |
| `/api/admin/tickets/[id]/messages` | POST | Respuesta administrativa con notificación al usuario |
| `/api/navigation-map` | GET | Mapa de navegación para RTFM con roles y permisos activos; requiere `rtfm.view` |
| `/api/auth/twitch/start` | GET | Inicia OAuth Twitch |
| `/api/auth/twitch/callback` | GET | Callback OAuth Twitch |
| `/api/profile` | GET | Perfil del usuario actual |
| `/api/profile/avatar` | POST | Actualizar avatar |
| `/api/lives` | GET | Lista de directos y estatuses |
| `/api/lives/[id]/notify` | POST | Crea una notificación pública manual de resubido y registra `Live.notifiedAt`; requiere `tracker.lives.notify` o `admin.lives.notify`, responde 403 ante sesión sin permiso y bloquea reenvíos concurrentes durante 10 segundos |
| `/api/admin/tracker/spreadsheet/export` | POST | Exporta a XLSX los registros filtrados y ordenados del mantenedor; requiere `tracker.export` |
| `/api/admin/tracker/spreadsheet/import` | POST | Previsualiza o aplica una actualización masiva XLSX con control de versión, validación integral y auditoría; requiere `tracker.import` |
| `/api/live-activity` | GET/POST | Actividad del usuario en directos |
| `/api/anime-library` | GET/POST | Biblioteca de anime (CRUD) |
| `/api/anime-calendar` | GET/POST | Temporadas y emisiones visibles (incluye favoritos del usuario si hay sesión); requiere `anime.calendar.view`. `POST` con `action: "toggle-favorite"` marca/desmarca un anime como favorito, requiere sesión |
| `/api/admin/anime-calendar` | GET/POST | Previsualización, sincronización, activación y overrides del calendario |
| `/api/anime-tier-list` | GET/POST | Tablero del Tier List (animes/openings/endings): `GET` con `kind` y `seasonId` devuelve roster y tablero guardado del usuario; `POST` con `action: "save"` autoguarda tiers/colocaciones, `"reset"` reinicia el tablero y `"set-public"` genera/retira el link compartido. Mutaciones requieren sesión. |
| `/api/admin/anime-tier-list-animes` | GET/POST | Roster de Animes del Tier List: sync preview/apply desde AniList y CRUD (`create-entry`, `update-entry`, `delete-entry`, `restore-entry`) |
| `/api/admin/audience` | GET | Resumen, historial y muestras por minuto de audiencia web; requiere `admin.audience.view` |
| `/api/admin/anime-tier-list-openings` | GET/POST | Openings/Endings del Tier List: sync preview/apply desde AnimeThemes.moe (requiere Animes ya sincronizado) y CRUD (`create-theme`, `update-theme`, `delete-theme`, `restore-theme`) |
| `/api/anime-library/anilist` | POST | Buscar en AniList |
| `/api/anime-activity` | GET/POST | Actividad del usuario en anime |
| `/api/twitch/status` | GET | Estado en vivo público: stream, perfil, canal y juego. Comparte caché de proceso por 30 segundos, deduplica refrescos concurrentes, conserva el último resultado válido hasta 2 minutos y admite caché CDN corta. Los consumidores del mismo navegador comparten además una caché cliente y una única promesa en vuelo para no duplicar solicitudes. No participa en OAuth ni sincronización de membresías. |
| `/api/twitch/eventsub` | POST | Webhook firmado: `stream.online` crea el card directamente desde el evento y publica una alerta deduplicada por stream; `stream.offline` cambia el registro Twitch activo a `Subiendo`. Ambos flujos dejan auditoría automática. |
| `/api/twitch/eventsub/subscribe` | POST | Verificar o registrar `stream.online` y `stream.offline`: lista cada tipo con el único filtro permitido por Twitch, conserva las suscripciones activas del callback actual y reemplaza estados obsoletos del mismo broadcaster. |
| `/api/youtube/videos` | GET | Últimos videos de YouTube para Inicio, con caché de proceso/CDN y sin escrituras en PostgreSQL por visitante |
| `/api/platform-users` | GET/POST | CRUD de usuarios |
| `/api/platform-roles` | GET/POST | CRUD de roles |
| `/api/tags` | GET/POST | CRUD de tags |
| `/api/upload` | POST | Subir imagen |
| `/api/mobile/v1/auth/login` | POST | Login manual para apps nativas; emite par access/refresh token |
| `/api/mobile/v1/auth/register` | POST | Registro manual para apps nativas |
| `/api/mobile/v1/auth/logout` | POST | Revoca la familia de refresh token del dispositivo |
| `/api/mobile/v1/auth/refresh` | POST | Rota el refresh token; detecta reuso y revoca toda la familia si el token ya fue rotado/revocado |
| `/api/mobile/v1/auth/me` | GET | Usuario actual resuelto por access token |
| `/api/mobile/v1/auth/delete-account` | POST | Borrado de cuenta self-service (anonimiza PII, revoca todo el material de auth) |
| `/api/mobile/v1/auth/oauth/[provider]/start` | GET | Inicia OAuth (Twitch/Google) para la app nativa |
| `/api/mobile/v1/auth/oauth/[provider]/callback` | GET | Callback OAuth web para la app; genera el código de canje de un solo uso |
| `/api/mobile/v1/auth/oauth/exchange` | POST | Canjea el código de un solo uso por el par de tokens móviles |
| `/api/mobile/v1/auth/oauth/complete-registration` | POST | Completa el alta de un `PlatformUser` nuevo vía OAuth desde `/mobile-auth/registro` |
| `/api/mobile/v1/auth/oauth/complete-link` | POST | Completa la vinculación de un proveedor OAuth a una cuenta existente desde `/mobile-auth/vincular` |
| `/api/mobile/v1/lives` | GET | Lista de directos para Lolweapon+ con permisos efectivos de guardado, notificación y edición; no usa caché |
| `/api/mobile/v1/lives/[id]` | GET | Detalle de un directo y permisos efectivos para la app móvil |
| `/api/mobile/v1/lives/[id]/edit` | PUT | Edita un directo con bearer token; exige `tracker.update` y una variante `tracker.form.full` o `tracker.form.compact` |
| `/api/mobile/v1/lives/[id]/notify` | POST | Envía la notificación manual de resubido desde Lolweapon+ con los mismos permisos que la web |
| `/api/mobile/v1/lives/activity` | GET/POST | Consulta o actualiza la actividad móvil del usuario sobre directos |
| `/api/mobile/v1/lives/[id]/playback` | POST | Persiste progreso de reproducción móvil para sincronizarlo con la web |
| `/api/lives/[id]/playback` | POST | Persiste progreso web del directo autenticado |
| `/api/mobile/v1/notifications/register-token` | POST | Registra o renueva un token FCM asociado opcionalmente al usuario y dispositivo |

---

## Routing multi-dominio

El middleware (`middleware.js`) distingue el dominio via `RESUBIDOS_HOST` / `VIENDO_HOST`:

| Dominio | Ruta raíz | Enfoque |
|---|---|---|
| `resubidos.lolweapon.com` | `/rastreador` | Archivo histórico de directos |
| `viendo.lolweapon.com` | `/biblioteca-anime/viendo` | Biblioteca de anime |
| `localhost` | `/rastreador` | Default en desarrollo |

---

## Flujos de autenticación

### Login manual
1. `POST /api/login` con login + password
2. Verificación con hash scrypt en BD
3. Sesión de 14 días — cookie `kala_admin_session` (httpOnly)

Para compartir la sesión entre `resubidos.lolweapon.com` y `viendo.lolweapon.com`, cada ambiente debe definir `SESSION_COOKIE_DOMAIN=.lolweapon.com` y usar un `SESSION_COOKIE_NAME` distinto. Login manual, registro y Twitch usan la misma configuración; logout elimina tanto la cookie compartida como cualquier cookie antigua limitada al host para el nombre configurado.

```env
# QA
SESSION_COOKIE_NAME=kala_admin_session_qa
SESSION_COOKIE_DOMAIN=.lolweapon.com

# Producción
SESSION_COOKIE_NAME=kala_admin_session
SESSION_COOKIE_DOMAIN=.lolweapon.com
```

### Login con Twitch (OAuth)
1. `GET /api/auth/twitch/start` → redirect a Twitch
2. Twitch callback → `GET /api/auth/twitch/callback`
3. Intercambio de código por token → fetch perfil + membresía
4. Si la identidad existe, crea sesión para su `PlatformUser`.
5. Si el correo ya existe, exige iniciar sesión con un método actual antes de vincular; la pantalla de login recibe pistas (`loginMethod`/`loginMethods`) para recomendar contraseña, Twitch o Google/YouTube sin adivinar. Si la cuenta tiene más de un método existente, se muestran todas las alternativas válidas.
6. Si es nuevo, guarda un intento temporal y redirige a `/registro?oauth=twitch` con email bloqueado, datos precargados y contraseña opcional.
7. Al completar registro, crea `PlatformUser`, identidad Twitch y sincroniza el rol automático por membresía.
8. Sesión creada → redirect a home

Twitch se resuelve por identidad externa, no por email o login. La migración desde `twitchUserId` conserva `roleId`. La sincronización de tiers pagados puede modificar roles con `roleSource=twitch` o rol actual `publico`; una asignación administrativa no pública usa `roleSource=manual` y no se pisa al conectar Twitch. El rol `tw-vip` no se puede obtener ni otorgar beneficios adicionales mientras la regla no esté autorizada.

### Login con Google/YouTube

1. `GET /api/auth/google/start` inicia OpenID Connect con `openid email profile`.
2. Google retorna a `GET /api/auth/google/callback`.
3. El servidor valida firma, issuer, audience, expiración, nonce, subject y correo verificado.
4. Si la identidad existe, crea sesión para su `PlatformUser`.
5. Si es nueva y el correo no existe, guarda un intento temporal y redirige a `/registro?oauth=google`.
6. El registro OAuth reutiliza `/registro`: email bloqueado desde Google, usuario/alias precargados editables, contraseña opcional y rol inicial `publico`.
7. Si el correo ya existe, exige iniciar sesión con contraseña u otro proveedor conectado antes de vincular; la pantalla de login recibe pistas (`loginMethod`/`loginMethods`) para recomendar uno o más métodos correctos.

Los intentos temporales de registro OAuth y vinculación son mutuamente excluyentes: al iniciar uno se limpia la cookie del otro. Un login OAuth normal no debe fallar por una cookie de vinculación expirada o perteneciente a otra cuenta; se ignora y se limpia para no bloquear usuarios sin contraseña manual.

En login manual, una cookie de vinculación pendiente expirada o perteneciente a otra cuenta tampoco debe convertir credenciales válidas en error. Si las credenciales son correctas, se crea la sesión, se limpia la cookie pendiente y la vinculación queda abandonada; para conectar la cuenta externa el usuario debe iniciar de nuevo el flujo desde perfil o desde el proveedor.

Google/YouTube no asigna automáticamente `yt-miembro`. La verificación de membresías del canal es independiente del login. Desde `/perfil` se pueden conectar o desconectar proveedores sin eliminar la cuenta ni su actividad. El rol `yt-miembro` no se puede obtener ni entregar beneficios adicionales hasta autorización explícita.

### Registro manual
1. `POST /api/register` con login, email, password, alias
2. Hash scrypt + rol `publico`
3. Sesión creada automáticamente

`lastLoginAt` se actualiza al crear cualquier sesión, por lo que cubre login manual, Twitch y la sesión automática posterior al registro. La migración `20260702123000_backfill_user_last_login_from_sessions` recupera el dato histórico únicamente cuando existe una sesión registrada.

### Endurecimiento de autenticación

- La cookie conserva el token de sesión aleatorio, pero PostgreSQL guarda únicamente su hash SHA-256. Una filtración de la tabla `PlatformSession` o de un dump no entrega bearer tokens reutilizables.
- La migración `20260816210000_harden_platform_sessions` elimina las sesiones anteriores al cambio; al desplegarla, todos los usuarios deben iniciar sesión nuevamente una vez.
- Las cookies de sesión continúan usando `HttpOnly`, `Secure` en producción y `SameSite=Lax`.
- Las mutaciones `/api/*` rechazan orígenes de navegador distintos al host actual. El webhook firmado `/api/twitch/eventsub` queda exento porque es una integración servidor-a-servidor.
- `LoginAttempt` conserva IP, login y user-agent durante 90 días por defecto. `LOGIN_ATTEMPT_RETENTION_DAYS` permite ajustar el plazo y la limpieza oportunista se ejecuta como máximo una vez cada seis horas cuando se registra un intento.
- Nginx publica `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y una `Permissions-Policy` conservadora mediante un snippet compartido. Next.js publica HSTS sin `includeSubDomains` y desactiva `X-Powered-By`. Una CSP queda diferida hasta inventariar y probar todos los embeds externos en QA.

### Auth móvil (Lolweapon+)

Sistema independiente de `PlatformSession`, para apps nativas. Bearer tokens opacos, hasheados en servidor con `lib/tokenHash.js` (nunca se guarda el token en texto plano).

1. Login/registro manual: `POST /api/mobile/v1/auth/login` o `/register` devuelve un par `accessToken` (15 min) + `refreshToken` (60 días, deslizante) directamente.
2. OAuth (Twitch/Google): `GET /api/mobile/v1/auth/oauth/[provider]/start` → proveedor → `GET /api/mobile/v1/auth/oauth/[provider]/callback` (mismo callback web, con `client_secret`) → genera un código de un solo uso (`PlatformMobileOAuthExchange`, 60 segundos) → la app hace `POST /api/mobile/v1/auth/oauth/exchange` con ese código y recibe su par de tokens. Si la identidad es nueva o requiere vincular, el callback redirige a `/mobile-auth/registro` o `/mobile-auth/vincular` (páginas web) antes de emitir el código.
3. Requests autenticadas: header `Authorization: Bearer <accessToken>`, resuelto por `getMobileUserIdFromRequest` (`lib/mobileAuth.js`).
4. Refresh: `POST /api/mobile/v1/auth/refresh` rota el refresh token (nuevo access + nuevo refresh). Si el token presentado ya fue rotado o revocado, se asume robo/reuso y se revoca toda la familia (`familyId`) — el dispositivo debe volver a loguearse.
5. Logout: `POST /api/mobile/v1/auth/logout` revoca solo la familia del dispositivo actual.
6. Borrado de cuenta: `POST /api/mobile/v1/auth/delete-account` llama `anonymizeAndDeactivatePlatformUser`, que scrubbea PII y revoca sesiones web + tokens móviles, pero conserva el contenido del usuario (tickets, ratings, tier lists) bajo el usuario anonimizado.

`middleware.js` exime `/api/mobile/*` de la validación de Origin/CSRF porque esta auth nunca depende de la cookie de sesión.

### Integración móvil del Rastreador

- Las rutas `/api/mobile/v1/lives/*` resuelven el usuario mediante bearer token, pero aplican los mismos permisos configurables que el frontend web.
- La edición requiere `tracker.update` junto con `tracker.form.full` o `tracker.form.compact`; el permiso de actualización por sí solo no habilita el formulario.
- `PlatformMobilePushToken` guarda direcciones FCM activas por instalación. Firebase se inicializa exclusivamente en servidor desde `FIREBASE_SERVICE_ACCOUNT_JSON`; `PlatformNotification.pushedAt` funciona como claim para no duplicar el envío push.
- `PlatformUserLivePlayback` mantiene la posición por usuario, directo y parte. El player web y `/mobile-embed/watch/[id]` escriben sobre esa misma persistencia mediante sus endpoints respectivos.
- El manifest `public/lolweapon-plus/latest.json` anuncia la versión descargable; el APK se publica fuera de Git para evitar versionar binarios.

---

## Data source

```env
DATA_SOURCE=json      # lectura desde /data/*.json (legado local)
DATA_SOURCE=postgres  # PostgreSQL vía Prisma (producción y QA)
DATABASE_POOL_MAX=12  # Máximo de conexiones del pool por proceso Node
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_STATEMENT_TIMEOUT_MS=15000
DATABASE_QUERY_TIMEOUT_MS=15000
DATABASE_IDLE_TRANSACTION_TIMEOUT_MS=15000
```

Los repositorios en `lib/repositories/` abstraen la diferencia — el frontend nunca sabe cuál se usa.
