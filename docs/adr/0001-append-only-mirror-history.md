# Keep mirror history append-only

The Contribution Mirror only adds missing Mirror Commits and never rewrites published history when a source Daily Contribution Count decreases. This may leave a historical day over-represented, but avoids destructive force-pushes and keeps every automated run safe and monotonic.
