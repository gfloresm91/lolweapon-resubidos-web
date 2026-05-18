# Release y despliegue

Guia operativa para versionar, commitear y desplegar la app en un droplet de DigitalOcean con Ubuntu, Next.js bajo systemd y Postgres en Docker.

## Versionado

La version actual vive en `package.json` y `package-lock.json`.

Para este ciclo se recomienda subir version **minor** si `v1.8.0` ya fue publicada, porque agrega mantenedores administrativos para Rastreador y Tags, endurece APIs/uploads, agrega permisos por módulo y nuevas migraciones:

```bash
npm version minor --no-git-tag-version
```

Ejemplo: `1.8.0` pasa a `1.9.0`.

Usa `patch` solo si estos cambios todavía son parte del mismo release no publicado y solo estás cerrando ajustes sobre esa versión:

```bash
npm version patch --no-git-tag-version
```

Usa `major` solo si rompes compatibilidad operativa o de datos:

```bash
npm version major --no-git-tag-version
```

Despues de cambiar version:

```bash
npm run build
git diff -- package.json package-lock.json
```

## Commit recomendado

Antes de commitear:

```bash
git status --short
git diff --stat
npm run build
```

Agregar cambios:

```bash
git add README.md docs/ package.json package-lock.json app components lib prisma scripts middleware.js .env.example docker-compose.prod.example.yml
```

Si solo quieres agregar todo lo pendiente del repo:

```bash
git add -A
```

Commit recomendado para este trabajo:

```bash
git commit -m "feat(admin): add platform maintainers and permissions" \
  -m "Add administration screens for Rastreador, Tags, Viendo and Terminados, permission-driven access, safer uploads, safer API payload handling, tag category rules, and Postgres sequence reset tooling." \
  -m "Document role permissions, menu order, database migration, sequence maintenance, and production rollout steps."
```

Si prefieres separar documentacion en otro commit:

```bash
git commit -m "docs: document platform administration deployment"
```

Tag recomendado despues del commit si vas a liberar esta version:

```bash
git tag v1.9.0
git push origin <branch>
git push origin v1.9.0
```

## Checklist local antes de produccion

```bash
npm install
npm run db:generate
npm run build
```

Si usas Postgres local:

```bash
docker compose up -d postgres
npm run db:migrate:deploy
DATA_SOURCE=postgres npm run audit:data
```

## Despliegue en DigitalOcean

Supuestos:

- Ubuntu en un droplet de DigitalOcean.
- Docker y Docker Compose ya instalados.
- Postgres corre en Docker.
- Next.js corre con systemd.
- El repositorio vive en `/srv/lolweapon-resubidos-web`.
- El servicio systemd se llama `lolweapon-resubidos`.

Ajusta rutas y nombre de servicio si tu droplet usa otros valores.

### 1. Entrar al servidor

```bash
ssh usuario@IP_DEL_DROPLET
cd /srv/lolweapon-resubidos-web
```

### 2. Detener la app

```bash
sudo systemctl stop lolweapon-resubidos
```

### 3. Respaldar antes de limpiar

Aunque quieras partir con data limpia, respalda primero.

```bash
mkdir -p backups/postgres
COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env npm run db:backup
```

Guarda una copia fuera del droplet si la data es importante:

```bash
scp usuario@IP_DEL_DROPLET:/srv/lolweapon-resubidos-web/backups/postgres/*.dump ./backups/
```

### 4. Actualizar codigo

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
npm ci
npm run db:generate
```

Si usas otra rama:

```bash
git checkout <branch>
git pull --ff-only origin <branch>
```

### 5. Revisar `.env`

Produccion debe usar Postgres:

```env
DATA_SOURCE=postgres
DATABASE_URL=postgresql://lolweapon:<password>@127.0.0.1:5432/lolweapon_resubidos
POSTGRES_DB=lolweapon_resubidos
POSTGRES_USER=lolweapon
POSTGRES_PASSWORD=<password>
POSTGRES_PORT=5432
TWITCH_AUTH_REDIRECT_URI=https://tu-dominio.com/api/auth/twitch/callback
TWITCH_BROADCASTER_LOGIN=kalathraslolweapon
UPLOAD_DIR=public/imagenes
```

Si QA o produccion usan mas de un dominio para la misma app, registra cada callback en Twitch Developers. Ejemplo QA:

```text
https://resubidos-qa.lolweapon.com/api/auth/twitch/callback
https://viendo-qa.lolweapon.com/api/auth/twitch/callback
```

La app usa el host actual cuando coincide con `RESUBIDOS_HOST` o `VIENDO_HOST`, para que la cookie OAuth `state` y el callback queden en el mismo dominio.

No expongas el puerto `5432` publicamente. El compose de produccion debe publicar Postgres en `127.0.0.1`.

### 6. Limpiar data antigua para partir desde cero

Opcion recomendada si quieres una base realmente limpia: eliminar el volumen de Postgres y recrear.

Advertencia: esto borra toda la base del compose actual.

```bash
docker compose -f docker-compose.prod.yml --env-file .env down -v
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres
```

Espera a que Postgres este sano:

```bash
set -a
source .env
set +a
docker compose -f docker-compose.prod.yml --env-file .env ps
docker compose -f docker-compose.prod.yml --env-file .env exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Alternativa si no quieres borrar el volumen, pero si limpiar el schema:

```bash
set -a
source .env
set +a
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
```

### 7. Aplicar migraciones

```bash
npm run db:migrate:deploy
```

Este paso crea tablas como `PlatformUser`, `PlatformRole`, `PlatformPermission`, `PlatformSession`, `LoginAttempt`, `PlatformUserLive` y el resto del modelo normalizado. También aplica permisos nuevos como `admin.anime.tracking.view` y `admin.anime.completed.view`.

### 8. Importar data base

Si quieres partir con contenido desde JSON versionado/local:

```bash
DATA_SOURCE=postgres npm run db:import:anime
DATA_SOURCE=postgres npm run db:import:lives
DATA_SOURCE=postgres npm run db:import:tags
DATA_SOURCE=postgres npm run db:import:spacedrum
```

Si quieres partir totalmente sin contenido operativo, omite esos imports. La app igual creara roles y permisos base al cargar.

Después de imports masivos, reajusta las secuencias autoincrementales para que los próximos IDs sigan desde el último registro real:

```bash
npm run db:reset-sequences
```

### 9. Validar y construir

```bash
DATA_SOURCE=postgres npm run audit:data
npm run build
```

### 10. Levantar systemd

```bash
sudo systemctl daemon-reload
sudo systemctl start lolweapon-resubidos
sudo systemctl status lolweapon-resubidos --no-pager
```

Ver logs:

```bash
journalctl -u lolweapon-resubidos -f
```

### 11. Smoke test

Desde el droplet:

```bash
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:3000/administracion/usuarios
curl -I http://127.0.0.1:3000/administracion/roles
```

Desde navegador:

- abrir `/login`
- registrar o iniciar sesion
- probar login Twitch
- abrir `/perfil`
- abrir `/administracion/usuarios`
- abrir `/administracion/roles`

### 12. Crear backup post despliegue

```bash
COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env npm run db:backup
```

## Rollback basico

```bash
sudo systemctl stop lolweapon-resubidos
git checkout <commit_o_tag_anterior>
npm ci
npm run db:generate
npm run build
sudo systemctl start lolweapon-resubidos
```

Si tambien debes restaurar base:

```bash
BACKUP_FILE=backups/postgres/<archivo>.dump COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env npm run db:restore
sudo systemctl restart lolweapon-resubidos
```
