export const TYPES = {
  paths: Symbol.for('AppPaths'),
  artifacts: Symbol.for('InstalledArtifacts'),
  configuration: Symbol.for('ConfigurationPort'),
  credentials: Symbol.for('CredentialPort'),
  source: Symbol.for('ContributionSourcePort'),
  identity: Symbol.for('DestinationIdentityPort'),
  mirrors: Symbol.for('MirrorRepositoryFactoryPort'),
  notifications: Symbol.for('NotificationPort'),
  state: Symbol.for('RunStatePort'),
  lock: Symbol.for('RunLockPort'),
  log: Symbol.for('LogPort'),
  clock: Symbol.for('ClockPort'),
  scheduler: Symbol.for('SchedulerPort'),
  diagnostics: Symbol.for('DiagnosticsPort'),
  logViewer: Symbol.for('LogViewerPort'),
  io: Symbol.for('CliIo')
} as const
