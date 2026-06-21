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
| `POST /helix/eventsub/subscriptions` | Registro de webhook `stream.online` |

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

---

### YouTube

**Archivo:** `lib/youtube.js`

| Endpoint | Uso |
|---|---|
| `GET /youtube/v3/channels` | Obtener playlist de uploads del canal |
| `GET /youtube/v3/playlistItems` | Últimos N videos (default: 10) |

**Datos devueltos por video:** `id`, `title`, `publishedAt`, `thumbnail`, `url`

No retorna duración ni views (requeriría llamada extra a `/videos` con `contentDetails`/`statistics` — costo adicional de cuota).

**Variables de entorno requeridas:**
```
YOUTUBE_API_KEY
YOUTUBE_CHANNEL_ID
YOUTUBE_CHANNEL_URL
YOUTUBE_UPLOADS_PLAYLIST_ID
```

---

### AniList

**Archivo:** `app/api/anime-library/anilist/route.js`

**Endpoint:** `https://graphql.anilist.co` — sin autenticación, sin variables de entorno.

**Queries:**
- `SearchAnimeById($id: Int)` — buscar por ID
- `SearchAnime($search: String)` — buscar por título

**Datos obtenidos:** título (romaji, english, native), descripción, formato (TV/Movie/OVA…), estado de emisión, episodios, año, imagen de portada, URL de AniList.

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

### Directos

| Modelo | Descripción |
|---|---|
| `Live` | Directo (legacyId, title, date, year, statusId, image, additionalInfo) |
| `LiveStatus` | En directo, Completo, Pendiente, Lost Media, Subiendo, Incompleto |
| `LiveTag` | Relación many-to-many Live ↔ Tag |
| `LiveLink` | Links por plataforma (telegram, okru, patreon, piero…) |
| `LinkPlatform` | Plataformas de links disponibles |

### Usuarios y autenticación

| Modelo | Descripción |
|---|---|
| `PlatformUser` | Usuario (twitchUserId, login, alias, email, avatarUrl, tier Twitch, roleId, isActive) |
| `PlatformRole` | Rol (code, label, canAdmin) |
| `PlatformPermission` | Permiso granular (code, label, group) |
| `PlatformRolePermission` | Relación rol ↔ permiso |
| `PlatformSession` | Sesión activa (token, expiresAt — 14 días) |
| `LoginAttempt` | Auditoría de intentos de login |
| `AuditLog` | Historial de acciones administrativas por mantenedor |

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

La sincronización de rol Twitch ocurre automáticamente en cada login: moderador → `moderador`, VIP → `tw-vip`, Tier 3/2/1 → `tw-tier-3/2/1`, resto → `publico`.

### Permisos principales

| Grupo | Códigos |
|---|---|
| Plataforma: Inicio | `home.view` |
| Plataforma: Novedades | `news.view` |
| Plataforma: Historial de cambios | `changelog.view` |
| Archivo VOD: Rastreador | `tracker.view`, `tracker.create/update/delete`, `tracker.form.full/compact` |
| Archivo VOD: Calendario | `tracker.calendar.view` |
| Biblioteca de anime: Viendo | `anime.tracking.view/create/update/delete`, `anime.tracking.form.full/compact` |
| Biblioteca de anime: Terminados | `anime.completed.view/create/update/delete`, `anime.completed.form.full/compact` |
| Biblioteca de anime: Puntuación | `anime.rating.write`, `anime.rating.streamer` |
| Lecturas: SpaceDrum | `spacedrum.view` |
| Administración: Usuarios | `users.read`, `users.create`, `users.update`, `users.delete` |
| Administración: Roles | `roles.read`, `roles.create`, `roles.update` |
| Administración: Rastreador | `admin.tracker.view` |
| Administración: Tags | `admin.tags.view`, `tags.create`, `tags.update`, `tags.delete` |
| Administración: Anime Viendo | `admin.anime.tracking.view` |
| Administración: Anime Terminados | `admin.anime.completed.view` |

---

## Rutas y páginas

### Páginas

| Ruta | Descripción |
|---|---|
| `/inicio` | Home: stream en vivo, últimos directos, últimos videos de YouTube |
| `/novedades` | Onboarding, beneficios por tipo de usuario, novedades recientes y tutoriales rápidos. Controlado por permiso `news.view` y asignado por defecto a todos los roles. |
| `/changelog` | Historial completo de versiones, mejoras y correcciones. Controlado por permiso `changelog.view` y asignado por defecto a todos los roles. |
| `/rastreador` | Tracker: lista de todos los directos con filtros |
| `/rastreador/calendario` | Calendario histórico de directos por año, mes y día. Controlado por permiso `tracker.calendar.view`, asignado por defecto a tiers Twitch, miembros YouTube, moderación y administración. |
| `/rastreador/[id]` | Detalle de un directo (links, actividad) |
| `/biblioteca-anime/viendo` | Anime en seguimiento: temporada entera, caps comprados o pendientes de compra |
| `/biblioteca-anime/terminados` | Anime terminado, pausado, pendiente o dropeado |
| `/mi-lista` | Lista personal del usuario (guardados, vistos, favoritos) |
| `/spacedrum` | Lector bilingüe de SpaceDrum, controlado por permiso `spacedrum.view` |
| `/login` | Login manual |
| `/registro` | Registro de usuario |
| `/perfil` | Perfil del usuario (avatar, datos) |
| `/administracion/...` | Panel de administración |

### API Routes

| Ruta | Método | Descripción |
|---|---|---|
| `/api/login` | POST | Login manual |
| `/api/register` | POST | Registro |
| `/api/logout` | POST | Cerrar sesión |
| `/api/auth/twitch/start` | GET | Inicia OAuth Twitch |
| `/api/auth/twitch/callback` | GET | Callback OAuth Twitch |
| `/api/profile` | GET | Perfil del usuario actual |
| `/api/profile/avatar` | POST | Actualizar avatar |
| `/api/lives` | GET | Lista de directos y estatuses |
| `/api/live-activity` | GET/POST | Actividad del usuario en directos |
| `/api/anime-library` | GET/POST | Biblioteca de anime (CRUD) |
| `/api/anime-library/anilist` | POST | Buscar en AniList |
| `/api/anime-activity` | GET/POST | Actividad del usuario en anime |
| `/api/twitch/status` | GET | Estado en vivo: stream, perfil, canal, juego |
| `/api/twitch/eventsub` | POST | Webhook `stream.online` de Twitch |
| `/api/twitch/eventsub/subscribe` | POST | Registrar suscripción EventSub |
| `/api/youtube/videos` | GET | Últimos videos de YouTube |
| `/api/platform-users` | GET/POST | CRUD de usuarios |
| `/api/platform-roles` | GET/POST | CRUD de roles |
| `/api/tags` | GET/POST | CRUD de tags |
| `/api/upload` | POST | Subir imagen |

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

### Login con Twitch (OAuth)
1. `GET /api/auth/twitch/start` → redirect a Twitch
2. Twitch callback → `GET /api/auth/twitch/callback`
3. Intercambio de código por token → fetch perfil + membresía
4. `findOrCreateTwitchUser` — crea o actualiza PlatformUser
5. Sincronización automática de rol por membresía
6. Sesión creada → redirect a home

### Registro manual
1. `POST /api/register` con login, email, password, alias
2. Hash scrypt + rol `publico`
3. Sesión creada automáticamente

---

## Data source

```env
DATA_SOURCE=json      # lectura desde /data/*.json (legado local)
DATA_SOURCE=postgres  # PostgreSQL vía Prisma (producción y QA)
```

Los repositorios en `lib/repositories/` abstraen la diferencia — el frontend nunca sabe cuál se usa.
