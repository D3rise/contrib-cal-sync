# Treat SCM VPN unavailability as recoverable

The configured private GitLab instance can be unreachable while the corporate VPN is disconnected, so source network failures are expected and recoverable. The service relies on its hourly schedule plus the notification Retry action after repeated failures; it does not add a proxy, custom CA, disabled TLS verification, or an internal infinite retry loop.
