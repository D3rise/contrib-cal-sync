# Use a native helper for actionable notifications

The Node.js application is accompanied by a minimal, interface-free Swift macOS helper that registers notification actions and handles the Retry button by starting a normal locked sync run. AppleScript notifications remain insufficient because they cannot reliably expose and dispatch a custom action; when notification permission or actions are unavailable, the CLI status and manual run remain the fallback.
