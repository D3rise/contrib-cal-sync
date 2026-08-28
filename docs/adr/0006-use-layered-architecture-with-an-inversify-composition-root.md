# Use layered architecture with an Inversify composition root

The application is divided into domain, application, infrastructure, presentation, and composition layers. Dependencies point inward: the application owns the capability ports it consumes, infrastructure implements those ports, and presentation invokes application interfaces without importing concrete adapters.

`ContributionSyncService.execute()` is the deep interface for contribution mirroring. It encapsulates the lock, bounded source retries, reconciliation, mirror commits, push, run state, notifications, logging, and cleanup. CLI command handlers remain thin delivery adapters around this and the smaller configuration and operational interfaces.

InversifyJS is used only in `src/composition` to assemble the object graph. Domain and application code do not use decorators, container lookups, or framework types. This keeps the business workflow independently testable while still providing one explicit IoC composition root for the executable.
