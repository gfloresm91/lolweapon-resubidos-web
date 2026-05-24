# Workflow: Release A Producción

Guía para preparar versión, tag y merge `dev` → `main`.

## Cuándo Usar Este Workflow

Usar cuando se va a liberar a producción. No usar para cada feature/fix en `dev`.

## Prechecks

1. QA probado en:
   - `https://resubidos-qa.lolweapon.com`
   - `https://viendo-qa.lolweapon.com`
2. No hay trabajo a medio implementar en `dev`.
3. Migraciones listas y versionadas.
4. `.env.example` actualizado si hubo variables nuevas.
5. Documentación actualizada.
6. `npm run build` OK.

## Elegir Versión

Usar semver:

- `patch`: bugfix o ajuste pequeño.
- `minor`: feature nueva o mantenedores nuevos.
- `major`: cambio incompatible o release grande.

Cambiar versión sin crear tag automático:

```bash
npm version patch --no-git-tag-version
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
```

Regla: el tag `vX.Y.Z` debe apuntar al commit que contiene el bump de versión en `package.json` y `package-lock.json`.

## Preparar `dev`

```bash
git checkout dev
git pull origin dev
git status --short
npm run build
```

Si se cambió versión:

```bash
git add package.json package-lock.json
git commit -m "chore(release): bump version to X.Y.Z"
git push origin dev
```

## Crear Tag

Crear tags solo para releases a producción:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Antes de crear el tag, confirmar:

```bash
git log --oneline -1
grep '"version"' package.json
```

El último commit debería ser `chore(release): bump version to X.Y.Z` o contener ese bump dentro del commit de release.

## Merge A Producción

```bash
git checkout main
git pull origin main
git merge dev --no-ff -m "chore(release): merge dev into main for vX.Y.Z"
git push origin main
git checkout dev
```

El push a `main` dispara GitHub Actions de producción.

## Monitoreo

GitHub Actions:

```bash
gh run list --limit 5
gh run view
```

Servidor producción:

```bash
sudo systemctl status resubidos.service
sudo journalctl -u resubidos.service -n 80
git -C /home/kalaplex/resubidos rev-parse --short HEAD
```

Servidor QA:

```bash
sudo systemctl status resubidos-qa.service
sudo journalctl -u resubidos-qa.service -n 80
git -C /home/kalaplex/resubidos-qa rev-parse --short HEAD
```

## Base De Datos

Producción aplica migraciones con:

```bash
npm run db:migrate:deploy
```

No crear migraciones en producción.

Si hay imports masivos:

```bash
DATA_SOURCE=postgres npm run db:reset-sequences
```

## Rollback

El workflow tiene rollback automático del build previo.

Rollback manual de código:

```bash
git checkout <commit_o_tag_anterior>
npm ci --prefer-offline
npm run db:generate
npm run build
sudo systemctl restart resubidos.service
```

Rollback de BD solo si hay backup y se confirma explícitamente:

```bash
BACKUP_FILE=backups/postgres/<archivo>.dump COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env npm run db:restore
sudo systemctl restart resubidos.service
```
