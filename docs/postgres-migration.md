# Postgres migration notes

Para release, versionado y despliegue completo en DigitalOcean/systemd, revisa tambien `docs/release-and-production.md`.

## Current state

The app can run with either JSON files or Postgres by changing `DATA_SOURCE`.

```env
DATA_SOURCE=json
DATA_SOURCE=postgres
```

Postgres is normalized and now covers:

- anime library
- tracker lives, statuses, tags, and links
- tag categories and overrides
- SpaceDrum content
- platform users and Twitch login sessions
- manual login credentials, Twitch-linked users and profile avatars
- platform roles, permissions, role-permission assignments and login attempts

JSON remains useful as a local fallback, source import format, and export safety format.

Recommended rollout for a new environment:

1. Audit the source data with `npm run audit:data`.
2. Start Postgres.
3. Add `DATABASE_URL` and `DATA_SOURCE=postgres` to `.env`.
4. Run `npm run db:generate`.
5. Deploy migrations with `npm run db:migrate:deploy`.
6. Import anime, lives, tags, and SpaceDrum.
7. Validate with `DATA_SOURCE=postgres npm run audit:data`.
8. Build with `DATA_SOURCE=postgres npm run build`.
9. Configure backups before relying on the database.

## Local Postgres

The included `docker-compose.yml` binds Postgres to `127.0.0.1` only:

```bash
docker compose up -d postgres
```

Default local connection:

```env
DATABASE_URL=postgresql://lolweapon:lolweapon@127.0.0.1:5432/lolweapon_resubidos
```

## Production droplet recommendation

Self-hosted Postgres on the DigitalOcean droplet is fine for this project.

Keep these rules:

- Do not expose port `5432` publicly.
- Prefer app-to-db traffic over Docker network or localhost.
- Use a persistent Docker volume for Postgres data.
- Run automated `pg_dump` backups daily.
- Copy backups off the droplet regularly.
- Test restore from backup before relying on it.

The current production shape keeps Next.js under systemd and runs only Postgres in Docker.

The repo includes `docker-compose.prod.example.yml` as a Postgres-only production template. Copy it on the droplet and keep using the existing `.env` file:

```bash
cp docker-compose.prod.example.yml docker-compose.prod.yml
```

Production essentials:

```env
DATA_SOURCE=postgres
POSTGRES_DB=lolweapon_resubidos
POSTGRES_USER=lolweapon
POSTGRES_PASSWORD=use-a-strong-password
POSTGRES_PORT=5432
DATABASE_URL=postgresql://lolweapon:use-a-strong-password@127.0.0.1:5432/lolweapon_resubidos
TWITCH_CLIENT_ID=your-twitch-client-id
TWITCH_CLIENT_SECRET=your-twitch-client-secret
TWITCH_AUTH_REDIRECT_URI=https://tu-dominio.com/api/auth/twitch/callback
```

If the same deployment is served by multiple domains, for example `RESUBIDOS_HOST` and `VIENDO_HOST`, register both OAuth callbacks in Twitch Developers:

```text
https://resubidos-qa.lolweapon.com/api/auth/twitch/callback
https://viendo-qa.lolweapon.com/api/auth/twitch/callback
```

The app will use the request host for OAuth when it matches one of the configured hosts. This keeps the OAuth state cookie and callback on the same domain.

The production compose binds Postgres to `127.0.0.1:${POSTGRES_PORT}` only, so it is reachable by the local systemd app but not exposed publicly.

Start Postgres:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres
```

The Next.js systemd service should keep running the app as it does today. After changing `.env` or deploying migrations, restart it with your service name, for example:

```bash
sudo systemctl restart lolweapon-resubidos
```

## Prisma commands

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:studio
npm run db:import:anime
npm run db:export:anime
npm run db:import:lives
npm run db:export:lives
npm run db:import:tags
npm run db:export:tags
npm run db:import:spacedrum
npm run db:export:spacedrum
npm run db:backup
npm run db:restore
npm run db:reset-sequences
```

Use `npm run db:migrate` only for local schema changes that should create a new migration. Use `npm run db:migrate:deploy` in production or when applying already committed migrations.

`npm run db:restore` requires `BACKUP_FILE`:

```bash
BACKUP_FILE=backups/postgres/lolweapon_resubidos_20260506T120000Z.dump npm run db:restore
```

`npm run db:reset-sequences` resets PostgreSQL autoincrement sequences to the next logical value for each table with an `id` column. It is useful after repeated imports or after fixing sequence drift. It does not renumber existing rows.

## Current schema scope

The schema is normalized instead of storing every anime field in one flat table.

Anime data is split across:

- `Anime`: core title, description, image, year, and episode metadata.
- `AnimeLibraryEntry`: library state, tracker tag, purchased/current episodes, hidden flag, and tracker URL.
- `AnimeFormat`, `AnimeReleaseStatus`, `AnimeWatchStatus`: catalog tables for repeated states and formats.
- `ExternalProvider` and `AnimeExternalReference`: AniList or future metadata providers.
- `TagCategory` and `Tag`: shared tag catalog intended for anime and tracker/lives.

Tracker data is split across:

- `Live`, `LiveStatus`
- `LiveTag`
- `LiveLink`, `LinkPlatform`

SpaceDrum data is split across:

- `SpaceDrum`
- `SpaceDrumMeta`
- `SpaceDrumLink`
- `SpaceDrumChapter`
- `SpaceDrumPage`

Platform administration data is split across:

- `PlatformRole`: role catalog. Initial roles are `Dios`, `Admin`, `Moderador`, `TW_Tier 1`, `TW_Tier 2`, `TW_Tier 3`, `TW_VIP`, `YT_Miembro`, `Publico`, and `Invitado`.
- `PlatformPermission`: permission catalog grouped by screen and action.
- `PlatformRolePermission`: assignment table between roles and permissions.
- `PlatformUser`: manual and Twitch-linked platform users, including `deletedAt` for logical deletion.
- `PlatformSession`: persistent login sessions.
- `LoginAttempt`: login audit and rate-limit support data.

Admin access is controlled by permissions, with `Dios` acting as an immutable superuser. This keeps temporary roles editable without changing application code.

Anime library permissions are intentionally split in two layers:

- `Anime: Viendo` and `Anime: Terminados` control public/library screen access and operational actions.
- `Administración: Rastreador` controls access to `/administracion/rastreador`.
- `Administración: Tags` controls access to `/administracion/tags`.
- `Administración: Viendo` and `Administración: Terminados` control access to the admin maintainers under `/administracion/biblioteca-anime`.

Administrative maintainers are controlled by permissions, not by a hard-coded role allowlist. `Dios` still acts as an immutable superuser and receives all permissions by default.

Runtime seed helpers create or update default roles and permissions without using blind `upsert`, so Postgres sequences do not advance artificially on every page load.

The tracker now uses the same repository switch as the anime library. With `DATA_SOURCE=json`, it reads and writes JSON. With `DATA_SOURCE=postgres`, it reads and writes normalized `Live`, `LiveStatus`, `LiveTag`, and `LiveLink` rows.

## Data source switch

The anime library API now goes through `lib/repositories/animeLibraryRepository.js`.

The tracker and live update flow now go through `lib/repositories/liveRepository.js`.

Tag settings now go through `lib/tagSettings.js`; the helper keeps the same public API but switches storage internally by `DATA_SOURCE`.

SpaceDrum now goes through `lib/repositories/spaceDrumRepository.js`.

Default mode keeps using JSON:

```env
DATA_SOURCE=json
```

Postgres mode reads and writes normalized rows through Prisma:

```env
DATA_SOURCE=postgres
```

The API surface stays the same:

```text
GET  /api/anime-library
POST /api/anime-library
GET  /api/lives
POST /api/update
GET  /api/tags
POST /api/tags
```

This means the frontend can be tested against Postgres without changing components. The repositories compact normalized rows back to the current JSON-compatible shape used by the UI.

## Anime import/export

Import reads `data/anime-metadata.local.json` when present, otherwise `data/anime-metadata.json`.

```bash
npm run db:import:anime
```

Export writes a new safety file and does not overwrite the source JSON:

```bash
npm run db:export:anime
```

Output:

```text
data/anime-metadata.export.json
```

Expected validation after import/export:

```bash
npm run audit:data
DATA_SOURCE=json npm run build
DATA_SOURCE=postgres npm run build
```

## SpaceDrum import/export

Import reads `data/spacedrum.local.json` when present, otherwise `data/spacedrum.json`.

```bash
DATA_SOURCE=postgres npm run db:import:spacedrum
```

Export writes a new safety file and does not overwrite the source JSON:

```bash
DATA_SOURCE=postgres npm run db:export:spacedrum
```

Output:

```text
data/spacedrum.export.json
```

SpaceDrum is normalized into:

- `SpaceDrum`: main page data.
- `SpaceDrumMeta`: ordered metadata items.
- `SpaceDrumLink`: ordered external links.
- `SpaceDrumChapter`: ordered chapters.
- `SpaceDrumPage`: ordered pages per chapter.

The export should keep the same page and chapter structure as the source JSON.

## Lives import/export

Import reads `data/data.local.json` when present, otherwise `data/data.json`.

```bash
npm run db:import:lives
```

Export writes a new safety file and does not overwrite the source JSON:

```bash
npm run db:export:lives
```

Output:

```text
data/data.export.json
```

Lives are split across normalized tables:

- `Live`: title, date, year, image, and additional info.
- `LiveStatus`: reusable status catalog.
- `Tag`, `TagCategory`, `LiveTag`: shared tags with original per-live order preserved.
- `LinkPlatform`, `LiveLink`: reusable link platform catalog and ordered links.

Expected validation after import/export:

```bash
npm run db:import:lives
npm run db:export:lives
DATA_SOURCE=postgres npm run build
```

The export should keep the same live IDs as the source JSON. Some status labels can be normalized by catalog casing, for example `Lost media` to `Lost Media`.

Runtime smoke checks:

```bash
DATA_SOURCE=postgres npm run dev
curl http://localhost:3000/api/lives
```

If port `3000` is busy, Next will print the replacement local URL.

## Tag settings import/export

Import reads `data/tag-settings.local.json` when present, otherwise `data/tag-settings.json`.

```bash
npm run db:import:tags
```

Export writes a new safety file and does not overwrite the source JSON:

```bash
npm run db:export:tags
```

Output:

```text
data/tag-settings.export.json
```

Tag settings are stored in the same normalized tag tables used by the tracker:

- custom categories are `TagCategory` rows with `isCustom = true`
- overrides are stored by assigning each `Tag` to a `TagCategory`

Expected validation:

```bash
DATA_SOURCE=postgres npm run db:import:tags
DATA_SOURCE=postgres npm run db:export:tags
DATA_SOURCE=postgres npm run build
```

## Production import checklist

On a fresh production database:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres
DATA_SOURCE=postgres npm run db:migrate:deploy
DATA_SOURCE=postgres npm run db:import:anime
DATA_SOURCE=postgres npm run db:import:lives
DATA_SOURCE=postgres npm run db:import:tags
DATA_SOURCE=postgres npm run db:import:spacedrum
DATA_SOURCE=postgres npm run audit:data
DATA_SOURCE=postgres npm run build
```

Then build the app and restart systemd:

```bash
npm run build
sudo systemctl restart lolweapon-resubidos
```

## Backups

Create a manual backup:

```bash
COMPOSE_FILE=docker-compose.prod.yml npm run db:backup
```

The backup and restore scripts load `.env` automatically when it exists. Use `ENV_FILE=/path/to/env` to point them elsewhere.

Recommended cron example:

```cron
15 4 * * * cd /srv/lolweapon-resubidos-web && COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env /usr/bin/npm run db:backup >> /var/log/lolweapon-postgres-backup.log 2>&1
```

Copy backup files outside the droplet regularly with `scp`, `rsync`, S3, or another storage provider.

Test restore against a disposable database before relying on backups:

```bash
BACKUP_FILE=backups/postgres/<file>.dump COMPOSE_FILE=docker-compose.prod.yml npm run db:restore
DATA_SOURCE=postgres npm run audit:data
```
