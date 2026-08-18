# AGENTS.md

Guía operativa para agentes de código en este repositorio. Aplica a todo el proyecto salvo que una instrucción más específica del usuario diga lo contrario.

## Contexto Del Proyecto

- App Next.js 15 App Router para el archivo VOD de Lolweapon y la biblioteca de anime.
- Runtime con `server.mjs`: envuelve Next.js y atiende WebSocket para notificaciones en `/api/notifications/ws`.
- Dos dominios principales desde la misma app:
  - `resubidos.lolweapon.com` → rastreador de directos.
  - `viendo.lolweapon.com` → biblioteca de anime.
- La app puede correr con `DATA_SOURCE=json` o `DATA_SOURCE=postgres`.
- Producción y QA usan PostgreSQL en Docker y la app corre con systemd.
- Ramas:
  - `dev` → QA.
  - `main` → producción.

Fuentes de contexto principales:
- `AGENTS.md`: fuente principal compartida para agentes.
- `CLAUDE.md`: reglas operativas existentes del proyecto.
- `docs/project-overview.md`: arquitectura, modelos, rutas, permisos y features.
- `docs/backlog.md`: decisiones diferidas y próximos trabajos.
- `docs/design-system.md`: estándares visuales de UI.
- `docs/workflows/`: flujos operativos versionados para release, deploy, QA DB y nuevas features.
- `docs/postgres-migration.md`: operación de PostgreSQL y migraciones.
- `docs/release-and-production.md`: versionado, release y deploy.

Memoria externa de Claude, útil para contexto histórico no versionado:
- `/Users/gabriel/.claude/projects/-Users-gabriel-Developer-kala-apps-lolweapon-resubidos-web/memory/`
- Archivos relevantes: `server-infrastructure.md`, `project-overview.md`, `user-profile.md`, `feedback.md`.

## Reglas De Seguridad

- Nunca commitear ni imprimir valores sensibles de `.env`, tokens, IPs privadas, secretos, dumps ni datos personales innecesarios.
- `.env` está en `.gitignore`; si se agrega una variable nueva, actualizar `.env.example` con valor vacío o seguro.
- Antes de comandos Prisma en QA/producción, recordar el riesgo de `DATABASE_URL` heredado del shell. En QA se recomienda `unset DATABASE_URL`.
- No ejecutar comandos destructivos (`rm`, `git reset --hard`, `git checkout --`, `docker compose down -v`) salvo petición explícita y clara del usuario.
- No revertir cambios no hechos por el agente. Si el worktree está sucio, trabajar alrededor y mencionar cualquier riesgo.

## Flujo De Trabajo

- Leer el contexto local antes de editar. Usar `rg`/`rg --files` para búsquedas.
- Si el usuario pide plan antes de código o la feature tiene decisiones de arquitectura, permisos, datos o UI responsiva, usar el análisis previo de `docs/workflows/new-feature.md` antes de editar.
- Implementar cambios solicitados de forma completa: código, estilos, rutas, permisos, migraciones, docs y verificación cuando aplique.
- Preferir patrones existentes del repo sobre nuevas abstracciones.
- Usar `apply_patch` para ediciones manuales.
- Mantener los cambios acotados a la solicitud.
- Para cambios visuales, homologar con componentes existentes antes de crear estilos nuevos.
- Para preguntas de revisión, responder con hallazgos primero, ordenados por severidad y con referencias a archivos/líneas.

## Comandos

Comandos habituales:

```bash
npm run dev
npm run build
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:backup
npm run db:restore
npm run db:import:lives
npm run db:import:anime
npm run db:import:tags
npm run db:import:spacedrum
npm run db:import:spacedrum:remote
npm run db:reset-sequences
npm run audit:data
```

Validación estándar después de cambios de código:

```bash
npm run build
```

Si el cambio toca solo documentación, no es necesario correr `npm run build` salvo que el usuario lo pida.

Después de cambios en `prisma/schema.prisma`:

```bash
npm run db:generate
```

Crear migraciones solo localmente:

```bash
npm run db:migrate
```

Aplicar migraciones en QA/producción:

```bash
npm run db:migrate:deploy
```

## Prisma Y Datos

- Los repositorios en `lib/repositories/` deben mantener la abstracción JSON/Postgres cuando la entidad ya lo soporta.
- Si una feature modifica schema, agregar migración versionada en `prisma/migrations/`.
- Formato de migración recomendado: `YYYYMMDDHHMMSS_descripcion_corta`.
- Después de imports masivos en PostgreSQL, usar `npm run db:reset-sequences` para evitar IDs autoincrementales altos o inconsistentes.
- No crear migraciones en producción/QA; solo aplicar migraciones ya versionadas.
- Cuando el usuario vuelva a preguntar por el procedimiento rápido de respaldo y restauración de la BD, usar estos comandos operativos conocidos:

```bash
npm run db:backup || echo "Advertencia: backup de DB falló, continuando de todas formas..."

BACKUP_FILE="$(ls -1t backups/postgres/*.dump | head -n 1)" \
npm run db:restore
```

- La advertencia del primer comando no confirma un respaldo válido: si aparece, revisar el error y no asumir que existe un dump nuevo antes de restaurar.
- Al restaurar una BD, `/login` y `/registro` validan la cookie mediante `/api/auth/session`; una sesión inexistente, expirada o inactiva limpia automáticamente la cookie obsoleta. Limpiar datos desde DevTools → Application queda solo como fallback de diagnóstico.
- Los scripts `db:backup`/`db:restore` detectan PostgreSQL por servicio Compose, luego por el contenedor `lolweapon-resubidos-postgres` y finalmente por herramientas instaladas en el host. Esto cubre QA cuando el contenedor está sano pero pertenece a otro proyecto Compose.

## Arquitectura Y Código

- Server Components cargan datos y pasan props a Client Components cuando sea posible.
- Evitar `useEffect` para fetch inicial si se puede resolver en Server Component.
- Las vistas montadas dentro de `HomePage` deben respetar a `HomePage` como dueño de la navegación interna.
  - No usar `router.push`/`router.replace` para cambiar vistas internas.
  - No mezclar `pushState`/`kala:navigation` con `window.location.href`; `window.location.href` solo para salidas reales como login/logout o enlaces externos.
  - Si una vista necesita reflejar estado propio en querystring, usar `history.replaceState` únicamente cuando `window.location.pathname` ya corresponde a esa vista.
- Toda vista nueva que se pueda abrir desde el menú interno y por URL directa debe soportar ambos caminos de carga.
  - La entrada directa debe recibir datos desde el Server Component.
  - La navegación interna SPA debe cargar datos desde `HomePage` al cambiar `currentView` si los props iniciales vienen vacíos.
  - No depender de recargar la página para poblar datos.
  - Al crear una pantalla nueva, probar navegación desde `/inicio`, desde otra vista existente y acceso directo por URL.
- Scroll infinito en vistas condicionales:
  - Si un listado usa `IntersectionObserver` y el sentinel se monta solo dentro de una vista (`currentView === "tracker"`, `myList`, etc.), el efecto debe depender también de la vista activa o de una clave equivalente de montaje.
  - El observer debe salir temprano cuando no corresponde a la vista actual y volver a crearse al entrar en la vista.
  - Error conocido corregido en `Rastreador`: al navegar desde otra pantalla, los directos ya estaban cargados y el efecto del observer no se reejecutaba porque dependía solo de `filteredLives.length`/`hasMoreLives`; el sentinel aparecía con `Cargando más resultados...`, pero no tenía observer activo. Solución: incluir `currentView` en dependencias y observar solo en `tracker`/`myList`.
- Validar en boundaries: formularios, route handlers y APIs externas.
- Route handlers deben responder JSON estructurado con status HTTP claro.
- Usar comentarios solo cuando expliquen un “por qué” no obvio.
- No agregar abstracciones prematuras.
- Mantener nombres:
  - Componentes: `PascalCase`.
  - Helpers/utils: `camelCase`.
- Para fechas renderizadas server/client, usar formato determinístico para evitar hydration mismatch.

## UI Y Diseño

- Mantener la línea visual existente: oscuro, bordes sutiles, radios moderados, estados claros.
- Ninguna pantalla debe mostrar badges, píldoras o etiquetas decorativas encima del título principal. Las cabeceras comienzan directamente con título y descripción; reservar badges para estados, conteos, categorías o información funcional dentro del contenido.
- Antes de cambios visuales grandes o de homologación con trade-offs, explicar la opción en 2-3 líneas y esperar confirmación.
- Ver `docs/design-system.md` para estándares concretos.
- Confort visual en tema oscuro:
  - El usuario reportó mareo/fatiga visual en pantallas con textos grises apagados sobre fondos oscuros texturizados, gradientes/transparencias superpuestas y bordes poco definidos.
  - Para perfil, formularios, mantenedores y pantallas largas, preferir superficies sólidas, contraste secundario medio-alto, gradientes mínimos y sombras discretas.
  - Ver `docs/design-system.md` → `Confort Visual En Temas Oscuros` antes de aplicar cambios visuales similares.
- Reutilizar componentes existentes:
  - `MaintainerTable`
  - `MaintainerToolbar`
  - `MaintainerStats`
  - `MaintainerModal`
  - `ConfirmModal`
  - `FilterSelect`
  - `FormSelect`
  - `Tooltip`
- Tablas de administración:
  - Seguir el estándar completo de mantenedores en `docs/design-system.md`.
  - Primera columna `ID` con formato `#id`.
  - `Estado` antes de `Acciones`.
  - Si la entidad no tiene estado real, no inventar una columna `Estado`; dejar antes de `Acciones` el dato operativo más relevante.
  - Acciones ordenadas: editar, cambiar contraseña si aplica, cambiar estado, eliminar.
  - Filtros deben incluir búsqueda por ID cuando exista.
  - Evitar subtexto repetido en celdas; si un dato se repite como metadata, preferir columna propia y búsqueda compatible.
  - Orden y paginación deben usar indicadores claros, selector no nativo, opción `Todos` y pruebas Playwright autenticadas.
  - Tablas anchas deben usar scroll horizontal propio en `.maintainer-table-scroll`, con `--maintainer-table-min-width` global suficiente para columnas y acciones completas, sin overflow global.
  - Si hay scroll horizontal real, mostrar arriba de la tabla la pista `Desliza horizontalmente para ver más columnas`; no mostrarla cuando la tabla cabe completa.
  - No versionar credenciales de prueba; usar variables locales para Playwright cuando se requiera login.
- Modales:
  - Fondo sólido estándar, no transparente.
  - Botón de cierre visible.
  - Espaciado superior/inferior equilibrado.
  - Confirmación para operaciones destructivas o de cambio de estado.
- Formularios:
  - Sin validaciones nativas HTML5 visibles.
  - Validación visual bajo el campo.
  - Toast para errores globales o de operación.
  - Mantener validaciones homologadas entre registro, perfil y mantenedores.
  - No usar `<select>` nativos en UI visible; usar `FilterSelect` para filtros y `FormSelect` para formularios.
- Botones que requieren sesión:
  - No redirigir de golpe si el usuario no está autenticado.
  - Mostrar toast/modal con explicación y acción para iniciar sesión.
- Responsive:
  - No basta con medir overflow global. Para cambios visuales, revisar screenshots móviles reales de las pantallas afectadas.
  - Probar estados autenticados cuando cambien acciones visibles por permiso, especialmente rol `Dios`.
  - Probar estados interactivos: menú lateral abierto, modales, dropdowns, tablas compactas y cards con todas sus acciones.
  - El menú lateral debe poder hacer scroll en mobile cuando existan más módulos que altura disponible.
- Parpadeos al hacer scroll:
  - Si una pantalla parpadea o titila solo al hacer scroll, revisar primero CSS antes de asumir un bug de datos o React.
  - Causa común en este proyecto: muchas cards con gradientes apilados, sombras grandes, filtros/backdrop-filter o transiciones de `transform` fuerzan repintados caros en Chromium.
  - Corrección rápida aplicada en `Novedades`: aislar solo el contenedor (`isolation: isolate`), reemplazar sombras grandes por sombras internas sutiles y retirar `contain: paint` de hero/cards repetidas.
  - No usar `contain: paint` como parche en páginas largas con muchas cards y gradientes; puede crear recomposición visible al hacer scroll en Chromium.
  - Evitar hover con `transform` en grids largos de cards informativas; preferir cambios de borde, fondo, color u opacidad.
  - Después de corregir, validar con scroll real en la pantalla afectada y ejecutar `npm run build` si hubo cambios de código/CSS.

## Roles Y Permisos

- El sistema debe respetar permisos configurados por rol; no bloquear por rol específico salvo reglas explícitas.
- Excepción: `Dios` es inmutable.
  - No se puede eliminar.
  - No se puede desactivar.
  - No se le cambia contraseña desde administración.
  - No se le cambia rol.
- `Dios` tiene acceso total por defecto, salvo exclusiones explícitas definidas por negocio.
- `anime.rating.streamer` es excepcional: solo un rol debería tenerlo y no debe asignarse automáticamente a `Dios`.
- `tracker.calendar.view` desbloquea el calendario histórico de directos y se asigna por defecto a tiers Twitch, miembros YouTube, moderación y administración.
- Si se agrega una pantalla o acción nueva, agregar el permiso correspondiente y verificar que aparezca en el mantenedor de roles.

## Autenticación

- Login manual, Twitch OAuth y futuro YouTube deben convivir.
- `PlatformSession.token` guarda el hash SHA-256 del bearer token entregado en la cookie, nunca el token reutilizable. Un cambio de estrategia de hash debe invalidar explícitamente las sesiones existentes mediante migración.
- Las mutaciones `/api/*` validan el origen del navegador en `middleware.js`; mantener exento `/api/twitch/eventsub` porque Twitch lo invoca servidor-a-servidor y valida su propia firma.
- `LoginAttempt` aplica retención configurable con `LOGIN_ATTEMPT_RETENTION_DAYS` (90 días por defecto). No agregar datos sensibles adicionales a esta auditoría.
- `PlatformUser` es la cuenta canónica; Twitch y Google/YouTube se vinculan mediante identidades externas.
- Una coincidencia de correo no autoriza una fusión automática. El usuario debe autenticarse con un método ya conectado antes de completar la vinculación.
- El identificador estable de cada proveedor es su subject externo, nunca el correo ni el login visible.
- Un OAuth nuevo sin cuenta existente debe completar `/registro?oauth=...` antes de crear `PlatformUser`: email bloqueado desde proveedor, login/alias precargados editables y contraseña opcional. Si el usuario agrega contraseña, debe validarse con las mismas reglas del registro manual.
- Google/YouTube no cambia roles. Twitch sincroniza roles con `roleSource=twitch` o cuando el rol actual es `publico`; una asignación administrativa no pública cambia la fuente a `manual`.
- Email es único y obligatorio.
- Usuario/login es único.
- Alias es visible públicamente y no necesariamente único.
- Mensajes de login deben evitar filtrar información sensible: para credenciales incorrectas usar mensaje genérico.
- Usuarios no autenticados se tratan como rol `invitado`.
- Apps nativas (Lolweapon+) no usan `PlatformSession`/cookie: ver `Features Sensibles` → `Auth Móvil (Lolweapon+)`.

## Administración Y Auditoría

- Los mantenedores administrativos deben registrar historial en `AuditLog` cuando cambian datos.
- Módulos auditados:
  - `admin.users`
  - `admin.roles`
  - `admin.tracker`
  - `admin.tags`
  - `admin.anime.tracking`
  - `admin.anime.completed`
- Sanitizar datos sensibles antes de guardar `before`/`after`.
- El historial no debe romper una operación si la tabla aún no existe; debe degradar con seguridad.

## Features Sensibles

### Twitch Player

- `PersistentTwitchPlayer` es delicado.
- En Inicio, la vista `Twitch` usa un player oficial dentro del flujo normal junto al chat para evitar que una capa fija active las protecciones anti-clickjacking; respeta pausas manuales. `PersistentTwitchPlayer` queda oculto en Inicio y se reserva para el mini player fuera de esa ruta. `VK + Twitch` mantiene su companion oficial separado, visible y silenciado junto al chat, con la política de reanudación específica aprobada para el modo dual.
- `/api/twitch/status` comparte durante 30 segundos el estado público del canal y deduplica refrescos simultáneos. `lib/twitch.js` reutiliza únicamente el token de aplicación, con expiración anticipada, timeout y un reintento ante `401`; no mezclar esta caché con los tokens OAuth de usuarios ni con la sincronización de roles Twitch.
- El registro manual de EventSub mantiene suscripciones `stream.online` y `stream.offline`. Para cada tipo lista usando el único filtro permitido por Twitch, identifica localmente el broadcaster y reemplaza únicamente suscripciones coincidentes que no estén activas para el callback configurado. Las revocaciones deben registrar `type`, `status` e `id` sin incluir secretos.
- Un `stream.online` con firma válida es evidencia suficiente para crear el card sin volver a depender inmediatamente de Helix; `TWITCH_REQUIRE_ACTIVE_STREAM` sigue aplicando a la creación manual. Las notificaciones EventSub se deduplican por ID del stream. `stream.offline` cambia el registro Twitch más reciente que siga `En directo` a `Subiendo`.
- Twitch iframe es cross-origin y puede pausar por reglas del navegador/Twitch.
- Cambios en full/mini player deben probar navegación, scroll, cambio de pestaña y estado offline.
- Si no hay directo, el mini player debe ocultarse.
- Si un dropdown/topbar queda bajo el player en `/inicio`, revisar stacking contexts antes de ocultar iframes o subir números a ciegas. Caso corregido: `.app-shell { z-index: 1; }` atrapaba el topbar bajo el `PersistentTwitchPlayer` fijo. La solución fue quitar ese `z-index`, mantener `.topbar` por encima y dejar los dropdowns superpuestos sin esconder video/chat. Ver `docs/design-system.md` → `Centro De Notificaciones` → `Capas Sobre Twitch`.

### Chulopuntos

- Puntuación de anime usa escala 1.0 a 8.0 con decimales.
- `AnimeRating.scoreTenths` guarda décimas.
- La esfera destacada del card muestra la nota del rol con permiso `anime.rating.streamer`.
- Usuarios sin permiso de calificar pueden ver la nota destacada si existe.

### Calendario De Temporada

- `/biblioteca-anime/calendario` muestra emisiones subtituladas concretas con permiso `anime.calendar.view`.
- AnimeSchedule es fuente de horarios/plataformas y AniList completa metadata; no mezclar estos snapshots con `Anime`/`AnimeLibraryEntry`.
- Guardar horarios en UTC y renderizarlos en la zona IANA detectada o elegida por el usuario.
- Contenido adulto y donghua quedan ocultos por defecto mediante preferencias independientes.
- La sincronización administrativa previsualiza cambios, conserva overrides, registra `AuditLog` y no elimina registros por una respuesta remota incompleta.

### Tier List De Temporada

- Dos tableros drag & drop (`AnimeTierListEntry` para animes, `AnimeTierListTheme` para openings/endings) completamente independientes de `SeasonalAnime`/Calendario — solo comparten la dimensión `AnimeSeason`. No reutilizar el sync del calendario para poblarlos.
- Animes se sincroniza directo desde la query nativa de temporada de AniList (sin AnimeSchedule). Openings/Endings se sincroniza desde AnimeThemes.moe (`findAnimeByExternalSite(site: ANILIST, id: [...])`) y depende de que Animes ya esté sincronizado para esa temporada.
- Selección de video por tema: prioriza la entry sin spoiler/nsfw y, dentro de ella, la mayor resolución (empate: fuente `BD` sobre `WEB`). Si solo hay entries con spoiler se guarda igual y se marca `isSpoiler`, oculto por defecto en el front.
- A diferencia del Calendario, los permisos `anime.tierlist.animes.view`/`anime.tierlist.openings.view` sí se asignan por defecto al rol `invitado`: los invitados pueden armar el tablero libremente, pero las mutaciones (`POST /api/anime-tier-list`) exigen sesión — sin eso no se guarda.
- Ambos mantenedores admin (`admin.anime.tierlist.animes.*`, `admin.anime.tierlist.openings.*`) tienen CRUD completo (crear, editar, soft-delete vía `deletedAt`, restaurar), a diferencia del Calendario que solo permite editar overrides.
- Si un admin oculta o elimina un anime/tema ya rankeado por algún usuario, la colocación se mantiene en el tablero guardado de ese usuario (marcada como oculta), pero deja de ofrecerse a usuarios nuevos.
- Tiers son personalizables por usuario (nombre, color, orden) y se autoguardan con debounce — no hay botón de guardar explícito.
- Compartir usa `shareToken` opaco (no el id secuencial) para evitar enumerar tableros ajenos; la página pública en `/biblioteca-anime/tier-list/compartido/[shareToken]` no usa el shell de `HomePage` (es Client Component propio, con sus propios filtros estándar/adulto/donghua/spoiler replicando la lógica del tablero privado).
- `AnimeTierListTheme.alternateVideoUrl` es un campo opcional independiente de `videoUrl`/`manualVideoUrl` (no es un override): sirve como respaldo manual por si el link de AnimeThemes.moe falla. El modal del tema muestra un pill "Video original"/"Video alternativo" solo cuando ese campo está configurado; por defecto siempre se reproduce el video de la API. Se completa en el mantenedor al crear o editar un tema.
- El reproductor del modal detecta automáticamente si la URL (principal o alternativa) es de YouTube, Google Drive o un archivo directo, y renderiza `<iframe>` o `<video>` según corresponda (`resolveVideoEmbed` en `AnimeTierListBoard.js`).
- El badge numerado (secuencia OP/ED) solo se muestra si el anime tiene más de un tema del mismo tipo en esa temporada; con una sola parte no se numera ni en la card ni en el título del modal (`applySequenceBadges`, calculado client-side sobre el roster ya cargado).
- El sync de Openings/Endings deduplica por `type`+`sequence` efectivo antes de guardar (`dedupeThemesBySequence` en `lib/animeTierListThemeSync.js`): si AnimeThemes.moe indexa dos `animeThemeId` distintos como el mismo OP/ED (variante/recorte alternativo), solo se guarda el de mejor puntaje (no-spoiler primero, luego mayor resolución). Como el sync nunca borra filas existentes, una duplicación creada ANTES de este fix requiere limpieza manual desde el mantenedor.
- Permiso `anime.tierlist.openings.manage` (grupo público "Biblioteca de anime: Tier List", default roles `admin`, `moderador` y `streamer`) habilita crear/editar/eliminar Openings/Endings directamente desde el tablero (no solo desde `/administracion`). El botón "Crear" vive en el pool ("Sin rankear"), a la izquierda del buscador, con el nombre del modal ("Agregar opening manual"/"Agregar ending manual" según el tablero). "Editar"/"Eliminar" viven bajo el título de cada card (icon buttons, solo con `canManageThemes`), abren modales propios independientes del modal de reproducción. Usa las mismas acciones (`create-theme`/`update-theme`/`delete-theme`) y repositorio que el mantenedor admin, pero vía `POST /api/anime-tier-list` con su propio chequeo de permiso — la ruta admin (`/api/admin/anime-tier-list-openings`) queda intacta y sigue exigiendo `admin.anime.tierlist.openings.*` (incluye `restore-theme`, que el tablero no expone). Los audit logs de ambos orígenes comparten el módulo `admin.anime.tierlist.openings` para que el historial del mantenedor los muestre juntos.
- Crear un tema (desde el tablero o desde `/administracion`) busca el anime directo en AniList (`AniListSearchModal`, mismo endpoint `/api/anime-library/anilist` que usa la biblioteca de Viendo/Terminados) en vez de elegir de una lista de `AnimeTierListEntry` ya cargadas. Al enviar, `createAnimeTierListTheme` hace `createAnimeTierListEntry({seasonId, aniListId})` (upsert idempotente por `[seasonId, aniListId]`) y crea el tema apuntando a esa entry — sigue siendo una FK real, sigue siendo sync-safe, pero ya no exige que el anime exista antes en el Tier List de Animes de esa temporada. El endpoint `/api/anime-library/anilist` acepta `anime.tierlist.openings.manage` además de los permisos de tracking, para que streamer/moderador puedan buscar sin tener permisos de la biblioteca de anime.
- El flujo de crear es de dos pasos secuenciales, igual que Viendo (`AnimeLibraryPage.js`): primero se abre `AniListSearchModal`, y solo al elegir resultado (o "Crear manualmente") se abre el modal de datos del tema. Nunca hay dos modales abiertos a la vez.
- `AnimeTierListEntry.aniListId` es nullable (`Int?`, migración `make_anime_tier_list_entry_anilist_id_optional`). "Crear manualmente" en el buscador de AniList crea el tema sin ficha de AniList: `createManualAnimeTierListEntry({seasonId, title, imageUrl})` guarda `aniListId: null` y usa el título tipeado directo como `titleRomaji`. Esa entry queda `isManual: true` y aparece también en el Tier List de Animes de esa temporada (comparten la misma tabla). El sync de temas (`animeTierListThemeSync.js`) ya ignora entries con `aniListId` nulo sin cambios adicionales — `fetchAnimeThemesByAniListIds` filtra ids no numéricos, y el `Map.get(null)` simplemente no matchea nada.
- Ocultar/mostrar un tema desde el tablero es un toggle (`Eye`/`EyeOff` en la card, bajo el título), no un botón fijo de "eliminar": si el tema está oculto el ícono pasa a "Mostrar" y llama `restore-theme` sin confirmación; si está visible, pide confirmación y llama `delete-theme` (soft-delete). `restore-theme` ahora también está expuesto en `POST /api/anime-tier-list` (antes solo en la ruta admin), gateado por el mismo permiso `anime.tierlist.openings.manage`.
- Un item oculto solo se mantiene visible para el dueño del tablero si está genuinamente colocado en una fila (placement con `tierKey` real). El autosave guarda un placement por cada item del pool también (`tierKey: null`), así que un item oculto que solo estaba en "Sin rankear" no cuenta como "ya rankeado" y desaparece del todo — `buildContainers` en `AnimeTierListBoard.js`/`PublicAnimeTierListPage.js` distingue ambos casos explícitamente.
- Toggle "Mostrar ocultos" (`filters.showHiddenByAdmin`) solo se renderiza con `canManageThemes`: deja ver en el pool los temas ocultos que no están rankeados en ninguna fila (para poder encontrarlos y volver a mostrarlos). No aplica a la vista pública/solo lectura.
- Las mutaciones rápidas de tema (crear/editar/ocultar/mostrar) llaman `loadBoard(seasonId, { silent: true })`: refrescan roster/tiers/placements sin pasar por el estado `isLoading` (sin skeleton), para no colapsar el alto de la página ni mandar el scroll arriba. "Reiniciar tablero" sigue usando la recarga visible a propósito.
- Editar el "Título" del tema solo se expone si `theme.isManual` es `true` (temas creados a mano, no sincronizados). Actualiza `AnimeTierListEntry.manualTitle` de la entry vinculada, no un campo propio del tema — por eso afecta a todos los temas de ese anime, no solo al que se está editando. Para temas sincronizados desde AnimeThemes.moe el título no es editable, se mantiene atado a la fuente.
- Editar/eliminar un tema desde el tablero abre modales propios (no embebidos en el modal de reproducción): los botones viven bajo el título de cada card, visibles solo con `canManageThemes`.

### Tags

- Tags se agrupan por reglas automáticas y overrides manuales.
- Si un tag no tiene uso, se puede eliminar con confirmación.
- Mantener categorías, iconos y keywords documentados.

### Auth Móvil (Lolweapon+)

- `/api/mobile/v1/auth/*` es un sistema de autenticación independiente de `PlatformSession` (cookie web), pensado para apps nativas (Lolweapon+/Store). Usa bearer tokens opacos hasheados en servidor con `lib/tokenHash.js`; el token en texto plano nunca se guarda.
- Modelos: `PlatformMobileRefreshToken` (60 días, deslizante, agrupado por `familyId`), `PlatformMobileAccessToken` (15 minutos) y `PlatformMobileOAuthExchange` (código de un solo uso, 60 segundos, puente entre el callback OAuth web —que tiene el `client_secret`— y el POST final de la app nativa).
- Rotación de refresh token con detección de reuso: si se presenta un refresh ya rotado, revocado o expirado, se asume compromiso y se revoca toda la familia (`lib/mobileAuth.js` → `rotateRefreshToken`/`revokeRefreshFamily`).
- `getMobileUserIdFromRequest` (`lib/mobileAuth.js`) es el equivalente móvil de resolver la sesión por cookie: lee el header `Authorization: Bearer`.
- OAuth Twitch/Google reutiliza `buildTwitchAuthorizeUrl`/`buildGoogleAuthorizeUrl`/`exchangeTwitchCode`/`exchangeGoogleCode` con un `redirectPath` alternativo. `getTwitchRedirectUri`/`getGoogleRedirectUri` (`lib/twitchOAuth.js`/`lib/googleOAuth.js`) siempre derivan las rutas móviles del origen real de la request; `TWITCH_AUTH_REDIRECT_URI`/`GOOGLE_AUTH_REDIRECT_URI` solo aplican al callback web por defecto.
- `/mobile-auth/registro` y `/mobile-auth/vincular` son páginas puente del sitio web para completar registro/vinculación OAuth iniciado desde la app — equivalentes móviles de `/registro?oauth=...`.
- `middleware.js` exime `/api/mobile/*` de la validación de Origin/CSRF porque esta auth es exclusivamente por bearer token, nunca por cookie. Si alguna ruta móvil empieza a confiar en la cookie de sesión, esta exención debe acotarse.
- Borrado de cuenta self-service usa `anonymizeAndDeactivatePlatformUser` (`lib/repositories/platformUserRepository.js`), distinto del soft-delete admin (`deletePlatformUser`): scrubbea PII (email, login, alias, avatar, password) y revoca todo el material de auth (identidades, sesiones web, tokens móviles), pero conserva el contenido del usuario (tickets, ratings, tier lists) asociado al usuario anonimizado.
- `public/lolweapon-plus/latest.json` es el manifest que consulta la app para detectar actualizaciones (`versionCode`, `versionName`, `apkUrl`, `changelog`). El `.apk` se sube manualmente al servidor; no se versiona en git.
- No confundir con `docs/backend-api.md`: ese archivo vive en el repo de la app móvil (fuera de este repo) y describe el contrato de estos endpoints desde el lado cliente.

### Sincronización XLSX Del Rastreador

- La exportación debe respetar todos los filtros y el orden activos, incluyendo todos los resultados y no solo la página visible.
- `ID_BD` e `ID_INTERNO` se muestran bloqueados y deben validarse nuevamente en servidor al importar.
- La importación actualiza registros existentes de forma integral, con previsualización campo a campo y control de versión contra cambios posteriores a la exportación.
- Errores, conflictos o filas nuevas bloquean la operación completa. La creación de registros desde XLSX está diferida en `docs/backlog.md`.

## Git, Versionado Y Deploy

- Regla de colaboración: el usuario ejecuta manualmente los comandos de Git relacionados con staging, commits, tags y pushes.
- El agente debe revisar estado/diff, validar cuando aplique y entregar el paso a paso exacto, pero no debe ejecutar `git add`, `git commit`, `git tag` ni `git push` salvo que el usuario lo pida explícitamente en esa conversación.
- Commits con convención:
  - `feat(scope): ...`
  - `fix(scope): ...`
  - `docs: ...`
  - `chore(release): ...`
- Para cambios grandes, preferir commit completo con cuerpo descriptivo.
- Antes de release:
  - `npm run build`
  - actualizar versión en `package.json`/`package-lock.json` si corresponde.
  - crear tag `vX.Y.Z` si corresponde.
- No sugerir tags para cada feature/fix en `dev`; los tags corresponden a releases que van a producción.
- Si el usuario menciona release, producción, merge a `main` o deploy productivo, recordar siempre:
  - bump de versión en `package.json` y `package-lock.json`
  - commit `chore(release): bump version to X.Y.Z`
  - tag `vX.Y.Z` apuntando al commit del bump
  - push del tag
- Push a `dev` despliega QA.
- Push a `main` despliega producción.
- Deploy recomendado vía GitHub Actions, no manual, salvo instrucciones explícitas.
- `npm start` usa `server.mjs`; Nginx debe permitir `Upgrade`/`Connection` para el WebSocket de notificaciones.
- `server.mjs` también ejecuta el sincronizador de YouTube en background para notificaciones realtime; revisar `YOUTUBE_NOTIFICATION_SYNC_ENABLED` y `YOUTUBE_NOTIFICATION_SYNC_INTERVAL_MS` si se cambia la cadencia.
- `server.mjs` publica notificaciones programadas cada 30 segundos. `PlatformNotification.publishedAt` debe asignarse una sola vez antes de emitir `notifications:update`; no mostrar registros inactivos, eliminados, no publicados o expirados.
- Notificaciones públicas usan `audience: all` y pueden llegar a invitados; invitados guardan leído/descartado en `localStorage`, autenticados en `PlatformUserNotification`. Novedades/changelog se sincronizan por `dedupeKey` desde `server.mjs`.
- Servicios systemd oficiales:
  - Producción: `resubidos.service`.
  - QA: `resubidos-qa.service`.

## Documentación

- Actualizar documentación cuando cambien:
  - variables de entorno
  - comandos
  - schema/migraciones
  - permisos
  - pantallas
  - deploy
  - decisiones importantes
- Usar `docs/backlog.md` para diferir trabajo con contexto suficiente para retomarlo.
- Usar `docs/project-overview.md` para arquitectura y estado actual.

## Preferencias Del Usuario

- El usuario prefiere homologación visual fuerte entre pantallas.
- El usuario prefiere decidir antes de aplicar cambios grandes de arquitectura, pero una vez aprobado espera implementación completa.
- El usuario suele trabajar iterativamente con screenshots; los ajustes visuales deben ser concretos y verificables.
- Responder en español neutro.
- Dar información completa cuando ayude a decidir, operar producción, documentar Git/deploy o entender trade-offs.
- Para cierres de implementación, incluir cambios relevantes, comandos ejecutados y pendientes operativos si existen.
- Si el usuario difiere una tarea, registrarla en `docs/backlog.md` y no insistir.
