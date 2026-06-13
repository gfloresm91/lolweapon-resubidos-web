# Backlog

Tareas pendientes, ideas y mejoras diferidas. Actualizar con cada sesión relevante.

## En progreso / Próximo

_(vacío)_

## Pendiente

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

## Ideas / Mejoras futuras

### Mantenedor de novedades

- La primera versión de `/novedades` y `/changelog` usa contenido estático versionado en el repositorio.
- Evolución futura: crear un mantenedor administrativo para publicar novedades, marcar cambios como destacados, definir audiencia, programar fechas y registrar auditoría.
- Ideas adicionales: marcar novedades como leídas por usuario, métricas de interacción, notificaciones internas y generación parcial del changelog desde tags/releases de Git.

### Doble polling de Twitch status

- `HomeDashboard` y `PersistentTwitchPlayer` hacen fetch a `/api/twitch/status` de forma independiente cada 60 segundos.
- Impacto: doble carga innecesaria al servidor de Twitch.
- Approach sugerido: compartir el estado via React Context o subir el fetch al Server Component y pasarlo como prop inicial, dejando solo un poller activo.

### Refactor de HomePage.js

- `components/HomePage.js` tiene ~1500 líneas y maneja 10+ vistas distintas (home, tracker, mi lista, anime, admin, spacedrum), todo el estado global, filtros, permisos y fetches.
- Impacto: difícil de mantener, todo el código se carga para todos los usuarios.
- Approach sugerido: separar cada vista en su propio componente contenedor con su estado local, y dejar `HomePage.js` solo como shell de navegación.
