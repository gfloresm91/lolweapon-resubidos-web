# lolweapon-resubidos-web

Archivo VOD y biblioteca de anime para el streamer Lolweapon. Sirve dos dominios desde la misma app Next.js: el tracker de resubidos y la biblioteca de anime. El middleware distingue el dominio usando `RESUBIDOS_HOST` / `VIENDO_HOST` del `.env`.

## Stack

- **Next.js 15** App Router, React Server Components
- **Prisma** ORM con PostgreSQL (Docker)
- **Tailwind CSS** + shadcn/ui
- **Autenticación**: Twitch OAuth + login manual con sesiones persistentes
- **Deploy**: DigitalOcean Droplet, systemd, GitHub Actions CI/CD

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

**Nombrado:** PascalCase para componentes, camelCase para utils y helpers.

**Server / Client:** Server Component fetches data y pasa props a un Client Component hijo. No mezclar fetch en `useEffect` donde se puede evitar.

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

## Gotchas conocidos

- **`npm run db:generate` es obligatorio después de `npm ci`** — sin esto, el build falla con `Cannot find module '.prisma/client/default'`. Ya está en los workflows de GitHub Actions, pero si se corre el build manualmente hay que hacerlo explícitamente.
- **`unset DATABASE_URL` antes de migrar en el servidor QA** — si la variable está seteada en el shell (puede pasar al hacer `source .env` de producción), Prisma la usa y conecta a la BD de producción ignorando el `.env` local del directorio de QA.
- **El deploy es exclusivamente vía GitHub Actions** — `scripts/deploy.sh` fue eliminado. Push a `dev` → QA, push a `main` → producción.
- **El `PersistentTwitchPlayer` es un componente complejo** — flota sobre todas las rutas como mini-player. El iframe de Twitch es cross-origin y no se puede controlar su `document.visibilityState`. Las pausas inesperadas se combaten con un keep-alive interval y `schedulePlaybackResume`.

## Slash commands disponibles

- `/release` — checklist completo de release a producción
- `/deploy-status` — verificar estado de producción y QA
- `/qa-db` — operaciones de base de datos en QA (imports, migraciones)
- `/new-feature` — checklist para agregar una feature nueva

## Release

Ver `/release` para el checklist completo de release a producción.
