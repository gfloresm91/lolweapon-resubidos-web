# Workflows

Playbooks operativos versionados para trabajar con el proyecto sin depender de comandos específicos de un agente.

## Flujos disponibles

| Archivo | Uso |
|---|---|
| `new-feature.md` | Checklist para implementar features con datos, UI, permisos y documentación |
| `release.md` | Preparar versión, commit, tag y merge hacia producción |
| `deploy-status.md` | Revisar estado de GitHub Actions, systemd, app y base de datos |
| `qa-db.md` | Operaciones seguras de base de datos en QA |
| `git-documentation.md` | Documentar cambios en Git: status, diff, commit, push y tag cuando aplique |

## Reglas generales

- Leer `AGENTS.md` antes de ejecutar un workflow.
- No ejecutar comandos destructivos sin confirmación explícita.
- En QA/producción, no crear migraciones; solo aplicar migraciones versionadas.
- Para cambios solo de documentación, no es necesario correr `npm run build` salvo que el usuario lo pida.
- Los tags se crean para releases hacia producción, no para cada feature/fix en `dev`.
