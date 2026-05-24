# Workflow: Documentar En Git

Guía para preparar commit, push, versión y tag cuando corresponda.

## Regla Operativa

El usuario ejecuta manualmente los comandos de Git de escritura:

- `git add`
- `git commit`
- `git tag`
- `git push`

El agente debe revisar estado/diff, validar con los comandos necesarios y entregar el paso a paso exacto para que el usuario lo ejecute. Solo ejecutar esos comandos si el usuario lo pide explícitamente en esa conversación.

## 1. Revisar Estado

```bash
git status --short
git diff --stat
```

Para cambios específicos:

```bash
git diff -- <archivo>
```

Verificar que no entren:

- `.env`
- dumps/backups
- archivos `.local.json`
- archivos `.export.json`
- imágenes subidas runtime si no deben versionarse
- credenciales, tokens, IPs privadas o datos personales

## 2. Clasificar El Cambio

Tipos recomendados:

- `feat(scope): ...` feature nueva
- `fix(scope): ...` corrección
- `docs: ...` documentación
- `chore(release): ...` versionado/release
- `refactor(scope): ...` refactor sin cambio funcional
- `style(scope): ...` ajuste visual/CSS sin lógica

Scopes comunes:

- `admin`
- `auth`
- `roles`
- `users`
- `tracker`
- `anime`
- `tags`
- `rating`
- `ui`
- `db`
- `deploy`

## 3. Verificación Antes Del Commit

Si hubo cambios de código:

```bash
npm run build
```

Si hubo cambios Prisma:

```bash
npm run db:generate
npm run build
```

Si solo cambió documentación, no es necesario correr build salvo petición explícita.

## 4. Commit

Agregar solo archivos relevantes:

```bash
git add <archivos>
```

Commit simple:

```bash
git commit -m "feat(scope): descripción clara"
```

Commit con cuerpo para cambios grandes:

```bash
git commit -m "feat(scope): descripción clara" \
  -m "Detalle de lo implementado, pantallas afectadas, permisos, migraciones y documentación actualizada."
```

## 5. Push

QA:

```bash
git push origin dev
```

Producción:

```bash
git push origin main
```

## 6. Versión

Cambiar versión solo si se está preparando release o el usuario lo pide:

```bash
npm version patch --no-git-tag-version
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
```

Después:

```bash
git add package.json package-lock.json
git commit -m "chore(release): bump version to X.Y.Z"
```

Si el usuario menciona release, producción, deploy productivo o merge a `main`, no omitir este paso. La versión debe quedar actualizada antes de crear el tag.

## 7. Tag

Crear tag solo para release a producción:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

No crear tag para cada feature/fix en `dev`.

El tag debe apuntar al commit que contiene el bump de versión. Verificar antes:

```bash
git log --oneline -1
grep '"version"' package.json
```

## 8. Mensaje Completo Sugerido

Formato recomendado para entregar al usuario:

```text
git status --short
npm run build
git add ...
git commit -m "feat(scope): ..." -m "..."
git push origin dev
```

Si corresponde release:

```text
npm version minor --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore(release): bump version to X.Y.Z"
git tag vX.Y.Z
git push origin dev
git push origin vX.Y.Z
```
