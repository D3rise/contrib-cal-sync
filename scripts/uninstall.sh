#!/bin/bash
set -euo pipefail

PURGE=false
if [[ "${1:-}" == "--purge" ]]; then
  PURGE=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: scripts/uninstall.sh [--purge]" >&2
  exit 2
fi

APP_ROOT="$HOME/Library/Application Support/contrib-cal-sync"
LOG_DIR="$HOME/Library/Logs/contrib-cal-sync"
CLI_FILE="$HOME/.local/bin/contrib-cal-sync"
PLIST_FILE="$HOME/Library/LaunchAgents/com.d3rise.contrib-cal-sync.plist"
LAUNCHCTL="${CONTRIB_CAL_SYNC_LAUNCHCTL:-/bin/launchctl}"
SECURITY="${CONTRIB_CAL_SYNC_SECURITY:-/usr/bin/security}"
UID_VALUE="$(id -u)"

"$LAUNCHCTL" bootout "gui/$UID_VALUE" "$PLIST_FILE" >/dev/null 2>&1 || true
rm -f "$PLIST_FILE" "$CLI_FILE" "$APP_ROOT/current" "$APP_ROOT/github-askpass.sh" "$APP_ROOT/run.lock"
rm -rf "$APP_ROOT/versions" "$APP_ROOT/cache"

if [[ "$PURGE" == "true" ]]; then
  "$SECURITY" delete-generic-password -a default -s com.d3rise.contrib-cal-sync.gitlab >/dev/null 2>&1 || true
  "$SECURITY" delete-generic-password -a default -s com.d3rise.contrib-cal-sync.github >/dev/null 2>&1 || true
  rm -rf "$APP_ROOT" "$LOG_DIR"
  echo "contrib-cal-sync removed with local configuration, logs, and credentials."
else
  echo "contrib-cal-sync removed. Configuration, logs, and Keychain credentials were preserved."
  echo "Run scripts/uninstall.sh --purge to remove preserved local data."
fi

echo "The remote mirror repository was not changed or deleted."
