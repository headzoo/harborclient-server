#!/bin/bash
set -euo pipefail

CONFIG_PATH="${TEAM_HUB_CONFIG:-/etc/team-hub/server.yaml}"
TEAM_HUB_DB_HOST="${TEAM_HUB_DB_HOST:-127.0.0.1}"
TEAM_HUB_DB_PORT="${TEAM_HUB_DB_PORT:-5432}"
TEAM_HUB_REDIS_HOST="${TEAM_HUB_REDIS_HOST:-127.0.0.1}"
TEAM_HUB_REDIS_PORT="${TEAM_HUB_REDIS_PORT:-6379}"
TEAM_HUB_START_POSTGRES="${TEAM_HUB_START_POSTGRES:-true}"
TEAM_HUB_START_REDIS="${TEAM_HUB_START_REDIS:-true}"
TEAM_HUB_DB_DRIVER="${TEAM_HUB_DB_DRIVER:-postgres}"

# Waits until a TCP port accepts connections or the retry budget is exhausted.
wait_for_tcp() {
  local host="$1"
  local port="$2"
  local label="$3"
  local attempts="${4:-60}"
  local attempt=1

  while [ "$attempt" -le "$attempts" ]; do
    if bash -c "exec 3<>/dev/tcp/${host}/${port}" 2>/dev/null; then
      exec 3>&-
      exec 3<&-
      echo "start-team-hub: ${label} is ready at ${host}:${port}"
      return 0
    fi

    echo "start-team-hub: waiting for ${label} at ${host}:${port} (${attempt}/${attempts})"
    sleep 1
    attempt=$((attempt + 1))
  done

  echo "start-team-hub: timed out waiting for ${label} at ${host}:${port}" >&2
  return 1
}

if [ "$TEAM_HUB_DB_DRIVER" = "postgres" ]; then
  wait_for_tcp "$TEAM_HUB_DB_HOST" "$TEAM_HUB_DB_PORT" "Postgres"
fi

wait_for_tcp "$TEAM_HUB_REDIS_HOST" "$TEAM_HUB_REDIS_PORT" "Redis"

cd /app
node dist/cli.js -c "$CONFIG_PATH" migrate
exec node dist/cli.js -c "$CONFIG_PATH" start
