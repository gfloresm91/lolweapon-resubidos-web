# lolweapon-resubidos-web

Archivo VOD y biblioteca de anime para el streamer Lolweapon. Sirve dos dominios desde la misma app Next.js: el tracker de resubidos y la biblioteca de anime. El middleware distingue el dominio usando `RESUBIDOS_HOST` / `VIENDO_HOST` del `.env`.

## Fuente compartida para agentes

`AGENTS.md` es la fuente principal compartida para Codex, Claude y otros agentes. Leerlo primero y mantenerlo sincronizado con este archivo.

Documentación complementaria:
- `docs/project-overview.md` — arquitectura, modelos, rutas, permisos y features.
- `docs/design-system.md` — estándares visuales de modales, tablas, botones, cards y formularios.
- `docs/backlog.md` — tareas diferidas y decisiones pendientes.
- `docs/workflows/` — flujos operativos versionados para release, deploy, QA DB y nuevas features.
- `docs/postgres-migration.md` — PostgreSQL, migraciones e imports.
- `docs/release-and-production.md` — versionado, commits, tags y deploy.

Memoria externa de Claude:
- `/Users/gabriel/.claude/projects/-Users-gabriel-Developer-kala-apps-lolweapon-resubidos-web/memory/`
- Archivos: `server-infrastructure.md`, `project-overview.md`, `user-profile.md`, `feedback.md`.

## Stack

- **Next.js 15** App Router, React Server Components
- **Prisma** ORM con PostgreSQL (Docker)
- **Tailwind CSS** + shadcn/ui
- **Autenticación**: Twitch OAuth + login manual con sesiones persistentes
- **Deploy**: DigitalOcean Droplet, systemd, GitHub Actions CI/CD
- **Servidor runtime**: `server.mjs` envuelve Next.js y atiende WebSocket para notificaciones en `/api/notifications/ws`.

## Fuente de datos

La app puede correr con JSON o Postgres según `DATA_SOURCE` en `.env`:

```env
DATA_SOURCE=json      # fallback local, sin BD
DATA_SOURCE=postgres  # producción y QA
```

Los repositorios en `lib/repositories/` abstraen esta diferencia. El frontend no sabe cuál se usa.

## Ramas y entornos

| Rama | Entorno |
|------|---------|
| `dev` | QA |
| `main` | Producción |

Push a `dev` → deploy automático a QA vía GitHub Actions.
Push a `main` → deploy automático a producción vía GitHub Actions.

## Entornos locales vs producción

**El `.env` local y el de producción tienen credenciales distintas.** Nunca asumir que son iguales. El `.env` de producción no está en el repo.

**Importante con Prisma**: si hay `DATABASE_URL` seteada como variable de entorno en el shell, Prisma la usa ignorando el `.env`. Hacer `unset DATABASE_URL` antes de correr migraciones en QA para evitar conectar a la BD de producción por error.

## Comandos npm

```bash
npm run dev                    # servidor de desarrollo
npm run build                  # build de producción
npm run db:generate            # generar cliente Prisma (necesario tras npm ci)
npm run db:migrate             # nueva migración (solo local)
npm run db:migrate:deploy      # aplicar migraciones (producción/QA)
npm run db:backup              # backup pg_dump
npm run db:restore             # restaurar backup (requiere BACKUP_FILE=...)
npm run db:import:lives        # importar tracker desde JSON
npm run db:import:anime        # importar biblioteca desde JSON
npm run db:import:tags         # importar tags desde JSON
npm run db:import:spacedrum    # importar SpaceDrum desde JSON
npm run db:import:spacedrum:remote # importar SpaceDrum ES/EN desde la web original
npm run db:reset-sequences     # resetear autoincrement tras imports
npm run audit:data             # auditar consistencia de datos
```

## Estructura clave

```
app/                        # Next.js App Router — rutas y páginas
  api/                      # Route handlers
  rastreador/               # Tracker de resubidos
  biblioteca-anime/         # Biblioteca de anime
  mi-lista/                 # Lista personal del usuario
  administracion/           # Panel de administración
components/                 # Componentes React reutilizables
lib/
  repositories/             # Abstracción JSON/Postgres por entidad
prisma/
  schema.prisma             # Schema de la BD
  migrations/               # Migraciones versionadas
docs/
  postgres-migration.md     # Guía completa de migración y comandos de BD
  release-and-production.md # Guía de release y deploy
.github/workflows/          # CI/CD — deploy-qa.yml y deploy-prod.yml
```

## Convenciones de código

- Sin comentarios salvo que el *por qué* sea no obvio
- Sin abstracciones prematuras — tres líneas similares están bien
- Sin manejo de errores para escenarios imposibles
- Validación solo en boundaries del sistema (input de usuario, APIs externas)
- Toast con acción en lugar de redirección forzada para usuarios no autenticados
- `loading.js` en cada ruta para skeleton states (comparten `AppShellLoading`)
- Para fechas renderizadas server/client, usar formato determinístico para evitar hydration mismatch.
- Para cambios solo de documentación, no es necesario correr `npm run build` salvo que el usuario lo pida.

**Nombrado:** PascalCase para componentes, camelCase para utils y helpers.

**Server / Client:** Server Component fetches data y pasa props a un Client Component hijo. No mezclar fetch en `useEffect` donde se puede evitar.

**Vistas internas e infinite scroll:** Si una vista dentro de `HomePage` usa `IntersectionObserver` para cargar más resultados, el efecto debe depender de la vista activa (`currentView`) o de una clave equivalente. El observer debe salir temprano fuera de su vista y volver a crearse al entrar. Bug corregido: al navegar desde otra pantalla al `Rastreador`, los directos ya estaban cargados, el efecto no se reejecutaba porque dependía solo de `filteredLives.length`/`hasMoreLives`, y el sentinel `Cargando más resultados...` quedaba sin observer activo.

**Errores en route handlers:** `try/catch` con respuesta JSON estructurada y status HTTP correspondiente:
```js
try {
  // ...
} catch {
  return Response.json({ error: "mensaje" }, { status: 500 });
}
```

**Estados de carga y error en el frontend:**
- Carga inicial de ruta → `loading.js` con `AppShellLoading`
- Mutaciones (guardar, eliminar) → estado local `isPending`/`isSaving` que deshabilita el botón
- Errores de operación → `toast.error(data?.error || "mensaje fallback")`

## Migraciones

Crear migraciones con nombre descriptivo en formato `YYYYMMDDHHMMSS_descripcion`:
```bash
npm run db:migrate  # crea la migración localmente
```

En producción/QA solo aplicar, nunca crear:
```bash
npm run db:migrate:deploy
```

## Variables de entorno

Al agregar una variable nueva al `.env`, siempre agregarla también en `.env.example` con el valor vacío o un valor por defecto seguro.

## Identidades de acceso

- `PlatformSession.token` guarda el hash SHA-256 del token de cookie. La migración de endurecimiento invalida las sesiones antiguas y obliga a iniciar sesión nuevamente una vez.
- Las mutaciones `/api/*` validan origen en `middleware.js`; `/api/twitch/eventsub` queda exento porque valida la firma de Twitch.
- Los registros `LoginAttempt` se conservan 90 días por defecto, configurable con `LOGIN_ATTEMPT_RETENTION_DAYS`.
- `PlatformUser` es la cuenta canónica y puede tener contraseña, Twitch y Google/YouTube conectados.
- Resolver identidades por proveedor + subject; no vincular automáticamente por correo o login.
- Si el correo ya existe, exigir autenticación con un método actual antes de conectar el proveedor nuevo.
- Un OAuth nuevo sin cuenta existente debe pasar por `/registro?oauth=...`: email bloqueado desde el proveedor, usuario/alias precargados editables y contraseña opcional. Si el usuario agrega contraseña, se validan las mismas reglas del registro manual.
- Google/YouTube no modifica roles. Twitch sincroniza roles cuando `roleSource=twitch` o cuando el rol actual es `publico`; una edición administrativa no pública fija `roleSource=manual`.
- Apps nativas (Lolweapon+) no usan `PlatformSession`/cookie, usan bearer tokens propios vía `/api/mobile/v1/auth/*`. Ver `AGENTS.md` → `Auth Móvil (Lolweapon+)` para el detalle completo.

## Gotchas conocidos

- **Calendario de temporada** — AnimeSchedule entrega emisiones `sub` y plataformas; AniList completa metadata. Los datos viven en modelos estacionales separados, los horarios se guardan en UTC y las sincronizaciones administrativas deben preservar overrides.

- **Tier List de temporada** — `AnimeTierListEntry`/`AnimeTierListTheme` son independientes de `SeasonalAnime` (solo comparten `AnimeSeason`); Animes sincroniza directo desde AniList (sin AnimeSchedule) y Openings/Endings desde AnimeThemes.moe, dependiendo de que Animes ya esté sincronizado. A diferencia del Calendario, `anime.tierlist.*.view` sí se asigna a `invitado` por defecto (pueden armar el tablero sin guardar) y ambos mantenedores admin tienen CRUD completo con soft-delete, no solo overrides. Un item ya rankeado que se oculte/elimine se mantiene marcado en el tablero guardado del usuario.

- **Importación XLSX del Rastreador** — `ID_BD` e `ID_INTERNO` son identificadores bloqueados y validados en servidor. La importación exige previsualización, rechaza archivos obsoletos mediante huella de origen y no crea filas nuevas en la primera etapa.
- **Restore y sesión obsoleta** — `/login` y `/registro` consultan `/api/auth/session`: si la cookie ya no corresponde a `PlatformSession`, se elimina automáticamente; si la BD falla temporalmente, devuelve 503 sin borrar la cookie. DevTools → Application queda como fallback de diagnóstico.

- **`npm run db:generate` es obligatorio después de `npm ci`** — sin esto, el build falla con `Cannot find module '.prisma/client/default'`. Ya está en los workflows de GitHub Actions, pero si se corre el build manualmente hay que hacerlo explícitamente.
- **`unset DATABASE_URL` antes de migrar en el servidor QA** — si la variable está seteada en el shell (puede pasar al hacer `source .env` de producción), Prisma la usa y conecta a la BD de producción ignorando el `.env` local del directorio de QA.
- **El deploy es exclusivamente vía GitHub Actions** — `scripts/deploy.sh` fue eliminado. Push a `dev` → QA, push a `main` → producción.
- **`npm start` usa servidor custom** — `server.mjs` mantiene Next.js y el canal WebSocket de notificaciones en el mismo puerto. Nginx debe permitir `Upgrade`/`Connection` para `/api/notifications/ws`.
- **YouTube notifica desde el servidor** — `server.mjs` ejecuta un sincronizador en background para detectar nuevos videos y emitir notificaciones por WebSocket aunque el usuario esté en cualquier página. Configuración: `YOUTUBE_NOTIFICATION_SYNC_ENABLED` y `YOUTUBE_NOTIFICATION_SYNC_INTERVAL_MS`.
- **YouTube en Inicio no escribe por visitante** — `/api/youtube/videos` mantiene caché compartida y respuesta CDN pública, pero no sincroniza `YoutubeVideo`. La persistencia y las notificaciones pertenecen al scheduler de `server.mjs`.
- **Inicio no carga todo el Rastreador** — el Server Component entrega solo los diez directos recientes. `HomePage` completa el catálogo desde `/api/lives` cuando la navegación interna entra a Rastreador, Calendario, Mi lista o Mantenedor Rastreador.
- **Notificaciones programadas** — `server.mjs` revisa publicaciones pendientes cada 30 segundos, fija `publishedAt` una sola vez y emite `notifications:update`. Las consultas públicas excluyen notificaciones inactivas, eliminadas, no publicadas o expiradas.
- **Invitados y notificaciones** — invitados solo ven `audience: all` y guardan leído/descartado en `localStorage`; usuarios autenticados usan `PlatformUserNotification`. Novedades/changelog públicos se crean una vez por `dedupeKey` desde `server.mjs`.
- **El `PersistentTwitchPlayer` es un componente complejo** — una sola instancia del SDK oficial se posiciona sobre el ancla de Inicio y se reutiliza como mini-player al navegar. El iframe es cross-origin: respetar pausas manuales, no forzar `play()` con intervalos ni mantenerlo activo cuando está oculto. Inicio ofrece `Twitch` y `VK + Twitch`; VK se monta solo en el modo dual y Twitch permanece visible y silenciado.
- **Estado público Twitch** — `/api/twitch/status` usa caché en memoria de 30 segundos, conserva el último resultado válido hasta 2 minutos ante una falla breve y comparte un único refresco concurrente. `lib/twitch.js` cachea solo el token de aplicación; OAuth de usuarios y sincronización de membresía permanecen separados.
- **Canal temporal para probar embeds** — `NEXT_PUBLIC_TWITCH_EMBED_LOGIN` reemplaza solo el canal visible en player, chat, enlaces y `/api/twitch/status`. Vacío usa `TWITCH_BROADCASTER_LOGIN`; no cambiar el broadcaster oficial solo para probar la UI porque también afecta OAuth, EventSub y archivado.
- **Registro EventSub** — Twitch permite un solo filtro al listar suscripciones. El mantenedor consulta por separado `type=stream.online` y `type=stream.offline`, filtra el broadcaster localmente, conserva cada suscripción `enabled` del callback actual y reemplaza estados obsoletos. El webhook registra el motivo de futuras revocaciones.
- **Procesamiento EventSub** — un `stream.online` firmado crea el card desde el payload sin esperar una segunda consulta Helix, evitando perder el evento si Twitch aún no refleja el stream. La comprobación `TWITCH_REQUIRE_ACTIVE_STREAM` se conserva para la acción manual y la alerta se deduplica por ID del stream. Al recibir `stream.offline`, el registro Twitch más reciente que siga `En directo` cambia automáticamente a `Subiendo`.
- **Auth móvil (Lolweapon+)** — `/api/mobile/v1/auth/*` es independiente de `PlatformSession`: bearer tokens opacos hasheados (`lib/tokenHash.js`), access token de 15 minutos y refresh de 60 días con rotación y detección de reuso (`lib/mobileAuth.js`). `middleware.js` exime `/api/mobile/*` de la validación de Origin porque no usa cookie. `public/lolweapon-plus/latest.json` versiona el manifest de actualización; el `.apk` se sube manualmente al servidor, no se versiona en git. Detalle completo en `AGENTS.md` → `Features Sensibles` → `Auth Móvil (Lolweapon+)`.
- **Rastreador móvil, push y playback** — `/api/mobile/v1/lives/*` reutiliza permisos del Rastreador web; editar exige `tracker.update` y una variante `tracker.form.*`. Los tokens FCM viven en `PlatformMobilePushToken` y usan `FIREBASE_SERVICE_ACCOUNT_JSON`; `PlatformNotification.pushedAt` evita duplicados. `PlatformUserLivePlayback` sincroniza progreso mediante endpoints web y móviles. El contrato cliente completo vive en `docs/backend-api.md` del repo Lolweapon+.

- **Dropdowns sobre Twitch** — si topbar/notificaciones/menú de usuario quedan debajo del player en `/inicio`, revisar primero stacking contexts. Caso corregido: `.app-shell { z-index: 1; }` encerraba el topbar bajo el `PersistentTwitchPlayer` fijo; se quitó ese `z-index` y se mantuvo el topbar sobre el player. No ocultar video/chat en desktop como parche.

## Infraestructura oficial

Producción:
- Directorio: `/home/kalaplex/resubidos`
- Servicio: `resubidos.service`
- Puerto interno: `3001`

QA:
- Directorio: `/home/kalaplex/resubidos-qa`
- Servicio: `resubidos-qa.service`
- Puerto interno: `3000`

PostgreSQL:
- Container Docker: `lolweapon-resubidos-postgres`
- Producción DB: `lolweapon_resubidos`
- QA DB: `lolweapon_resubidos_qa`

Comandos systemd de referencia:

```bash
sudo systemctl status resubidos.service
sudo journalctl -u resubidos.service -f
sudo systemctl status resubidos-qa.service
sudo journalctl -u resubidos-qa.service -f
```

## Preferencias de colaboración

- Responder en español neutro.
- Dar información completa cuando ayude a decidir, operar producción, documentar Git/deploy o entender trade-offs.
- Para cierres de implementación, incluir cambios relevantes, comandos ejecutados y pendientes operativos si existen.
- Si el usuario difiere una tarea, registrarla en `docs/backlog.md` y no insistir.
- No sugerir tags salvo en releases hacia producción.
- El usuario ejecuta manualmente `git add`, `git commit`, `git tag` y `git push`. El agente debe entregar el paso a paso exacto y validar estado/diff/build cuando aplique, pero no ejecutar esos comandos salvo instrucción explícita en esa conversación.
- Para cambios visuales con trade-off, explicar la opción en 2-3 líneas y esperar confirmación antes de aplicar.

## Slash commands disponibles

- `/release` — checklist completo de release a producción
- `/deploy-status` — verificar estado de producción y QA
- `/qa-db` — operaciones de base de datos en QA (imports, migraciones)
- `/new-feature` — checklist para agregar una feature nueva

## Release

Ver `/release` para el checklist completo de release a producción.

Regla importante: si el usuario menciona release, producción, merge a `main` o deploy productivo, recordar siempre bump de versión en `package.json`/`package-lock.json` y tag `vX.Y.Z`. El tag debe apuntar al commit que contiene el bump de versión.
