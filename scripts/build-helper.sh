#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$PROJECT_DIR/dist/ContributionNotificationHelper.app"
EXECUTABLE_DIR="$APP_DIR/Contents/MacOS"
MODULE_CACHE="$PROJECT_DIR/.build/swift-module-cache"

mkdir -p "$EXECUTABLE_DIR" "$MODULE_CACHE"
cp "$PROJECT_DIR/native/Info.plist" "$APP_DIR/Contents/Info.plist"
CLANG_MODULE_CACHE_PATH="$MODULE_CACHE" xcrun swiftc \
  -parse-as-library \
  -module-cache-path "$MODULE_CACHE" \
  -target "$(uname -m)-apple-macosx13.0" \
  -framework AppKit \
  -framework UserNotifications \
  -o "$EXECUTABLE_DIR/ContributionNotificationHelper" \
  "$PROJECT_DIR/native/NotificationHelper.swift"
