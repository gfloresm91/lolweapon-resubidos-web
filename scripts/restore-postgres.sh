#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.example.yml}"
ENV_FILE="${ENV_FILE:-.env}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=postgres-runtime.sh
source "$SCRIPT_DIR/postgres-runtime.sh"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB is required}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER is required}"
BACKUP_FILE="${BACKUP_FILE:?BACKUP_FILE is required. Example: BACKUP_FILE=backups/postgres/lolweapon_resubidos_20260506T120000Z.dump npm run db:restore}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi
compose_args=(-f "$COMPOSE_FILE")

if [[ -f "$ENV_FILE" ]]; then
  compose_args+=(--env-file "$ENV_FILE")
fi

configure_postgres_runtime
echo "PostgreSQL runtime: $POSTGRES_RUNTIME_SELECTED"

"${POSTGRES_EXEC[@]}" \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --exit-on-error --no-owner --no-privileges \
  < "$BACKUP_FILE"

echo "Restored $BACKUP_FILE into $POSTGRES_DB"
