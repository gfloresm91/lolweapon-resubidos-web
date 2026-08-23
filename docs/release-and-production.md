# Release y producción

Referencia operativa de alto nivel. Los procedimientos ejecutables y mantenidos viven en `docs/workflows/`; este archivo no los duplica para evitar que existan dos versiones distintas del deploy.

## Estado actual

- `dev` despliega QA mediante `.github/workflows/deploy-qa.yml`.
- `main` despliega producción mediante `.github/workflows/deploy-prod.yml`.
- Producción: `/home/kalaplex/resubidos`, servicio `resubidos.service`, puerto interno `3001`.
- QA: `/home/kalaplex/resubidos-qa`, servicio `resubidos-qa.service`, puerto interno `3000`.
- PostgreSQL corre en el contenedor `lolweapon-resubidos-postgres`; producción y QA usan bases separadas.
- `npm start` ejecuta `server.mjs`, que sirve Next.js y los WebSocket de la aplicación.

## Procedimientos oficiales

- Preparación de versión, changelog, tag, merge y rollback: [`docs/workflows/release.md`](workflows/release.md).
- Verificación de GitHub Actions, servicios y bases de datos: [`docs/workflows/deploy-status.md`](workflows/deploy-status.md).
- Migraciones, imports y operaciones sobre la BD de QA: [`docs/workflows/qa-db.md`](workflows/qa-db.md).
- Preparación de commits y comandos Git para el usuario: [`docs/workflows/git-documentation.md`](workflows/git-documentation.md).
- Operación detallada de PostgreSQL y backups: [`docs/postgres-migration.md`](postgres-migration.md).

## Reglas de release

1. Validar QA y ejecutar `npm run build`.
2. Documentar el release en `lib/newsGuideContent.js` antes del bump.
3. Actualizar `package.json` y `package-lock.json` con SemVer.
4. Crear el commit `chore(release): bump version to X.Y.Z`.
5. Crear `vX.Y.Z` apuntando al commit que contiene el bump y publicar el tag.
6. Integrar `dev` en `main`; el push a `main` inicia el deploy productivo.

El usuario ejecuta manualmente `git add`, `git commit`, `git tag` y `git push`, salvo que pida explícitamente al agente hacerlo.

## Qué ejecutan los workflows

Ambos entornos:

1. Guardan temporalmente el build `.next` anterior.
2. Actualizan la rama correspondiente.
3. Ejecutan `npm ci --prefer-offline`.
4. Ejecutan `npm run db:generate` y `npm run build`.
5. Aplican las migraciones versionadas con `npm run db:migrate:deploy`.
6. Reinician el servicio systemd y comprueban que quede activo.
7. Restauran el build anterior si falla el proceso.

Producción además crea un backup PostgreSQL antes de aplicar migraciones. El directorio `backups/postgres` debe existir y ser escribible por el usuario del deploy; si el backup falla, el workflow se detiene.

## Reglas de seguridad

- No crear migraciones en QA o producción; allí solo se aplican migraciones versionadas.
- Antes de comandos Prisma manuales en QA, ejecutar `unset DATABASE_URL` para evitar heredar la URL de producción.
- No restaurar una base de datos ni limpiar datos sin confirmación explícita y un backup validado.
- No asumir que un deploy terminó correctamente solo porque el push fue exitoso; comprobar GitHub Actions y el servicio con el workflow de estado.
