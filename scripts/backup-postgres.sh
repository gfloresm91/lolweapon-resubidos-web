#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.example.yml}"
ENV_FILE="${ENV_FILE:-.env}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
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

mkdir -p "$BACKUP_DIR"

if [[ ! -w "$BACKUP_DIR" ]]; then
  echo "Backup directory is not writable: $BACKUP_DIR" >&2
  echo "Fix its ownership before retrying, for example: sudo chown -R \"$(id -u):$(id -g)\" \"$BACKUP_DIR\"" >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/${POSTGRES_DB}_${timestamp}.dump"
partial_file="${backup_file}.partial"
compose_args=(-f "$COMPOSE_FILE")

if [[ -f "$ENV_FILE" ]]; then
  compose_args+=(--env-file "$ENV_FILE")
fi

configure_postgres_runtime
echo "PostgreSQL runtime: $POSTGRES_RUNTIME_SELECTED"

cleanup_partial() {
  rm -f "$partial_file"
}
trap cleanup_partial EXIT

"${POSTGRES_EXEC[@]}" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges \
  > "$partial_file"

if [[ ! -s "$partial_file" ]]; then
  echo "Backup file is empty: $partial_file" >&2
  exit 1
fi

"${POSTGRES_EXEC[@]}" \
  pg_restore --list < "$partial_file" > /dev/null

mv "$partial_file" "$backup_file"
trap - EXIT

echo "Backup verified and written to $backup_file"
