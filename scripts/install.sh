#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${CONTRIB_CAL_SYNC_NODE:-$(command -v node || true)}"
NO_CONFIG=false

if [[ "${1:-}" == "--no-config" ]]; then
  NO_CONFIG=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: scripts/install.sh [--no-config]" >&2
  exit 2
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "contrib-cal-sync requires macOS 13 or newer." >&2
  exit 1
fi
MACOS_VERSION="${CONTRIB_CAL_SYNC_MACOS_VERSION:-$(sw_vers -productVersion)}"
MACOS_MAJOR="${MACOS_VERSION%%.*}"
if [[ ! "$MACOS_MAJOR" =~ ^[0-9]+$ ]] || (( MACOS_MAJOR < 13 )); then
  echo "macOS 13 or newer is required; found ${MACOS_VERSION:-unknown}." >&2
  exit 1
fi
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js 22 or newer is required. Install it and rerun this script." >&2
  exit 1
fi
NODE_VERSION="$($NODE_BIN --version 2>/dev/null || true)"
NODE_MAJOR="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
if [[ ! "$NODE_MAJOR" =~ ^[0-9]+$ ]] || (( NODE_MAJOR < 22 )); then
  echo "Node.js 22 or newer is required; found ${NODE_VERSION:-unknown}." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js 22 with npm and rerun this script." >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "Git is required. Install Xcode Command Line Tools and rerun this script." >&2
  exit 1
fi
if ! xcrun --find swiftc >/dev/null 2>&1; then
  echo "A Swift toolchain is required. Install Xcode Command Line Tools and rerun this script." >&2
  exit 1
fi

if [[ "${CONTRIB_CAL_SYNC_SKIP_BUILD:-0}" != "1" ]]; then
  (
    cd "$PROJECT_DIR"
    npm ci
    npm run build
    npm run build:helper
  )
fi

if [[ ! -f "$PROJECT_DIR/dist/main.js" ]]; then
  echo "Build output dist/main.js is missing." >&2
  exit 1
fi
if [[ "${CONTRIB_CAL_SYNC_SKIP_BUILD:-0}" != "1" && ! -x "$PROJECT_DIR/dist/ContributionNotificationHelper.app/Contents/MacOS/ContributionNotificationHelper" ]]; then
  echo "The native notification helper was not built." >&2
  exit 1
fi

VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PROJECT_DIR/package.json" | head -n 1)"
if [[ -z "$VERSION" ]]; then
  echo "Unable to read package version." >&2
  exit 1
fi

APP_ROOT="$HOME/Library/Application Support/contrib-cal-sync"
VERSIONS_DIR="$APP_ROOT/versions"
RELEASE_NAME="$VERSION-$(date +%Y%m%d%H%M%S)-$$"
STAGE_DIR="$VERSIONS_DIR/.stage-$RELEASE_NAME"
RELEASE_DIR="$VERSIONS_DIR/$RELEASE_NAME"
CURRENT_LINK="$APP_ROOT/current"
CLI_DIR="$HOME/.local/bin"
CLI_FILE="$CLI_DIR/contrib-cal-sync"
PLIST_FILE="$HOME/Library/LaunchAgents/com.d3rise.contrib-cal-sync.plist"
LAUNCHCTL="${CONTRIB_CAL_SYNC_LAUNCHCTL:-/bin/launchctl}"
LAUNCH_DOMAIN="gui/$(id -u)"
OLD_TARGET="$(readlink "$CURRENT_LINK" 2>/dev/null || true)"
ACTIVATED=false
WAS_LOADED=false

rollback() {
  local code=$?
  if [[ "$ACTIVATED" == "true" ]]; then
    if [[ -n "$OLD_TARGET" ]]; then
      ln -s "$OLD_TARGET" "$CURRENT_LINK.rollback"
      mv -fh "$CURRENT_LINK.rollback" "$CURRENT_LINK"
    else
      rm -f "$CURRENT_LINK"
      rm -f "$CLI_FILE"
    fi
  fi
  rm -rf "$STAGE_DIR" "$RELEASE_DIR"
  if [[ "$WAS_LOADED" == "true" && -f "$PLIST_FILE" ]]; then
    "$LAUNCHCTL" bootstrap "$LAUNCH_DOMAIN" "$PLIST_FILE" >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap rollback ERR

if "$LAUNCHCTL" print "$LAUNCH_DOMAIN/com.d3rise.contrib-cal-sync" >/dev/null 2>&1; then
  WAS_LOADED=true
  "$LAUNCHCTL" bootout "$LAUNCH_DOMAIN" "$PLIST_FILE" >/dev/null 2>&1 || true
fi

mkdir -p "$STAGE_DIR" "$CLI_DIR"
cp -R "$PROJECT_DIR/dist" "$STAGE_DIR/dist"
cp "$PROJECT_DIR/package.json" "$STAGE_DIR/package.json"
mkdir -p "$STAGE_DIR/node_modules"
cp -R "$PROJECT_DIR/node_modules/@inversifyjs" "$STAGE_DIR/node_modules/@inversifyjs"
cp -R "$PROJECT_DIR/node_modules/inversify" "$STAGE_DIR/node_modules/inversify"
cp -R "$PROJECT_DIR/node_modules/reflect-metadata" "$STAGE_DIR/node_modules/reflect-metadata"
[[ -f "$PROJECT_DIR/README.md" ]] && cp "$PROJECT_DIR/README.md" "$STAGE_DIR/README.md"
[[ -f "$PROJECT_DIR/LICENSE" ]] && cp "$PROJECT_DIR/LICENSE" "$STAGE_DIR/LICENSE"
mv "$STAGE_DIR" "$RELEASE_DIR"

ln -s "versions/$RELEASE_NAME" "$CURRENT_LINK.new"
# On macOS, -h replaces the symlink itself instead of moving into its target.
mv -fh "$CURRENT_LINK.new" "$CURRENT_LINK"
ACTIVATED=true

{
  printf '%s\n' '#!/bin/bash'
  printf 'exec %q %q "$@"\n' "$NODE_BIN" "$CURRENT_LINK/dist/main.js"
} > "$CLI_FILE"
chmod 755 "$CLI_FILE"

if [[ "$NO_CONFIG" == "false" ]]; then
  "$CLI_FILE" configure
elif [[ "$WAS_LOADED" == "true" && -f "$APP_ROOT/config.json" ]]; then
  "$CLI_FILE" service restart
fi

trap - ERR
ACTIVATED=false
echo "contrib-cal-sync $VERSION installed."
echo "CLI: $CLI_FILE"
if [[ ":$PATH:" != *":$CLI_DIR:"* ]]; then
  echo "Add $CLI_DIR to PATH to invoke contrib-cal-sync directly."
fi
