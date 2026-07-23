#!/usr/bin/env bash

configure_postgres_runtime() {
  local requested_runtime="${POSTGRES_RUNTIME:-auto}"
  local compose_container_id=""

  POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-lolweapon-resubidos-postgres}"
  POSTGRES_EXEC=()
  POSTGRES_RUNTIME_SELECTED=""

  if [[ "$requested_runtime" == "auto" || "$requested_runtime" == "compose" ]]; then
    if command -v docker > /dev/null 2>&1; then
      compose_container_id="$(docker compose "${compose_args[@]}" ps -q "$POSTGRES_SERVICE" 2> /dev/null || true)"
      if [[ -n "$compose_container_id" ]] && [[ "$(docker inspect -f '{{.State.Running}}' "$compose_container_id" 2> /dev/null || true)" == "true" ]]; then
        POSTGRES_EXEC=(docker compose "${compose_args[@]}" exec -T "$POSTGRES_SERVICE")
        POSTGRES_RUNTIME_SELECTED="compose"
        return
      fi
    fi
    if [[ "$requested_runtime" == "compose" ]]; then
      echo "PostgreSQL Compose service is not running: $POSTGRES_SERVICE" >&2
      return 1
    fi
  fi

  if [[ "$requested_runtime" == "auto" || "$requested_runtime" == "container" ]]; then
    if command -v docker > /dev/null 2>&1 && [[ "$(docker inspect -f '{{.State.Running}}' "$POSTGRES_CONTAINER" 2> /dev/null || true)" == "true" ]]; then
      POSTGRES_EXEC=(docker exec -i "$POSTGRES_CONTAINER")
      POSTGRES_RUNTIME_SELECTED="container"
      return
    fi
    if [[ "$requested_runtime" == "container" ]]; then
      echo "PostgreSQL container is not running: $POSTGRES_CONTAINER" >&2
      return 1
    fi
  fi

  if [[ "$requested_runtime" == "auto" || "$requested_runtime" == "host" ]]; then
    if command -v pg_dump > /dev/null 2>&1 && command -v pg_restore > /dev/null 2>&1; then
      POSTGRES_RUNTIME_SELECTED="host"
      export PGHOST="${POSTGRES_HOST:-127.0.0.1}"
      export PGPORT="${POSTGRES_PORT:-5432}"
      export PGPASSWORD="${POSTGRES_PASSWORD:-}"
      return
    fi
    if [[ "$requested_runtime" == "host" ]]; then
      echo "pg_dump and pg_restore are required for host mode." >&2
      return 1
    fi
  fi

  echo "PostgreSQL runtime not found. Checked Compose service '$POSTGRES_SERVICE', container '$POSTGRES_CONTAINER', and host tools." >&2
  return 1
}

