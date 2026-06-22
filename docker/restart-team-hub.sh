#!/bin/bash
set -euo pipefail

CONFIG_PATH="${TEAM_HUB_CONFIG:-/etc/team-hub/server.yaml}"
found=0

for pid_path in /proc/[0-9]*; do
  pid="${pid_path#/proc/}"
  cmdline="$(tr '\0' ' ' < "${pid_path}/cmdline" 2>/dev/null || continue)"

  case "${cmdline}" in
    *node*dist/cli.js*"${CONFIG_PATH}"*start*)
      echo "restart-team-hub: sending SIGTERM to pid ${pid}"
      kill -TERM "${pid}"
      found=1
      ;;
  esac
done

if [ "${found}" -eq 0 ]; then
  echo "restart-team-hub: Team Hub start process not found (config: ${CONFIG_PATH})" >&2
  exit 1
fi

echo "restart-team-hub: supervisord will restart Team Hub (migrate + start)"
