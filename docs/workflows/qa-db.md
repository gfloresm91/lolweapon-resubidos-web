# Workflow: Base De Datos QA

Operaciones seguras para la BD de QA.

## Regla Crítica

Antes de cualquier comando Prisma en QA:

```bash
unset DATABASE_URL
```

Si hubo `source .env` previo, `DATABASE_URL` puede apuntar a producción y Prisma lo prioriza sobre el `.env` del directorio actual.

## Contexto

- Directorio QA: `/home/kalaplex/resubidos-qa`
- Servicio QA: `resubidos-qa.service`
- Container Postgres: `lolweapon-resubidos-postgres`
- DB QA: `lolweapon_resubidos_qa`
- DB producción: `lolweapon_resubidos`

QA usa el mismo container que producción, pero una base de datos distinta.

## Aplicar Migraciones

```bash
cd /home/kalaplex/resubidos-qa
unset DATABASE_URL
npm run db:migrate:deploy
npm run db:generate
sudo systemctl restart resubidos-qa.service
```

## Importar Datos Desde JSON

Usar solo si se quiere poblar o resetear contenido desde archivos versionados/locales:

```bash
cd /home/kalaplex/resubidos-qa
unset DATABASE_URL
DATA_SOURCE=postgres npm run db:import:lives
DATA_SOURCE=postgres npm run db:import:anime
DATA_SOURCE=postgres npm run db:import:tags
DATA_SOURCE=postgres npm run db:import:spacedrum
DATA_SOURCE=postgres npm run db:reset-sequences
```

## Verificar Tablas

```bash
docker exec lolweapon-resubidos-postgres \
  psql -U lolweapon -d lolweapon_resubidos_qa -c "\dt"
```

Conteos útiles:

```bash
docker exec lolweapon-resubidos-postgres \
  psql -U lolweapon -d lolweapon_resubidos_qa -c "SELECT COUNT(*) FROM \"Live\";"

docker exec lolweapon-resubidos-postgres \
  psql -U lolweapon -d lolweapon_resubidos_qa -c "SELECT COUNT(*) FROM \"PlatformUser\";"

docker exec lolweapon-resubidos-postgres \
  psql -U lolweapon -d lolweapon_resubidos_qa -c "SELECT COUNT(*) FROM \"AuditLog\";"
```

## Acceder A psql

```bash
docker exec -it lolweapon-resubidos-postgres \
  psql -U lolweapon -d lolweapon_resubidos_qa
```

Siempre especificar `-d`; si no, `psql` intentará una DB con el nombre del usuario.

## Crear DB QA Si Faltara

Solo si la DB QA no existe:

```bash
cd /home/kalaplex/resubidos
source .env
docker exec lolweapon-resubidos-postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "CREATE DATABASE lolweapon_resubidos_qa OWNER \"$POSTGRES_USER\";"
```

## Reset Limpio

Operación destructiva. Requiere confirmación explícita.

```bash
docker exec lolweapon-resubidos-postgres \
  psql -U lolweapon -d lolweapon_resubidos_qa -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

cd /home/kalaplex/resubidos-qa
unset DATABASE_URL
npm run db:migrate:deploy
DATA_SOURCE=postgres npm run db:import:lives
DATA_SOURCE=postgres npm run db:import:anime
DATA_SOURCE=postgres npm run db:import:tags
DATA_SOURCE=postgres npm run db:import:spacedrum
DATA_SOURCE=postgres npm run db:reset-sequences
sudo systemctl restart resubidos-qa.service
```
