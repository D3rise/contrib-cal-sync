import { Container } from 'inversify'
import { ConfigurationService } from '../application/configuration.service.js'
import { ContributionSyncService } from '../application/contribution-sync.service.js'
import type { DiagnosticsPort, LogViewerPort, SchedulerPort } from '../application/operations.ports.js'
import type {
  ClockPort, ConfigurationPort, ContributionSourcePort, CredentialPort, DestinationIdentityPort,
  LogPort, MirrorRepositoryFactoryPort, NotificationPort, RunLockPort, RunStatePort
} from '../application/sync.ports.js'
import { GitMirrorRepositoryFactory } from '../infrastructure/git/git-mirror.repository.js'
import { GitHubApiClient, GitHubDestinationIdentityAdapter } from '../infrastructure/github/github-api.client.js'
import { JsonConfigurationAdapter } from '../infrastructure/configuration/json-configuration.adapter.js'
import { LaunchdSchedulerAdapter, resolveInstalledArtifacts, type InstalledArtifacts } from '../infrastructure/macos/launchd-scheduler.adapter.js'
import { MacNotificationAdapter } from '../infrastructure/macos/notification.adapter.js'
import { LogViewerAdapter } from '../infrastructure/observability/log-viewer.adapter.js'
import { RotatingLogAdapter } from '../infrastructure/observability/rotating-log.adapter.js'
import { FileRunLockAdapter, JsonRunStateAdapter } from '../infrastructure/persistence/json-run-state.adapter.js'
import { KeychainCredentialAdapter } from '../infrastructure/security/keychain-credential.adapter.js'
import { GitLabCalendarAdapter } from '../infrastructure/source/gitlab-calendar.adapter.js'
import { SystemClockAdapter } from '../infrastructure/system/system-clock.adapter.js'
import { SystemDiagnosticsAdapter } from '../infrastructure/system/diagnostics.adapter.js'
import { resolvePaths, type AppPaths } from '../infrastructure/system/paths.js'
import { CliController } from '../presentation/cli/cli.controller.js'
import type { CliIo, CommandHandler } from '../presentation/cli/command-handler.js'
import { ConsoleIo } from '../presentation/cli/console-io.js'
import { ConfigurationCommandHandler } from '../presentation/cli/handlers/configuration.handler.js'
import { CredentialsCommandHandler } from '../presentation/cli/handlers/credentials.handler.js'
import { DiagnosticsCommandHandler } from '../presentation/cli/handlers/diagnostics.handler.js'
import { LogsCommandHandler } from '../presentation/cli/handlers/logs.handler.js'
import { ServiceCommandHandler } from '../presentation/cli/handlers/service.handler.js'
import { SetupCommandHandler } from '../presentation/cli/handlers/setup.handler.js'
import { StatusCommandHandler } from '../presentation/cli/handlers/status.handler.js'
import { SyncCommandHandler } from '../presentation/cli/handlers/sync.handler.js'
import { TYPES } from './tokens.js'

export interface ContainerOptions { readonly paths?: AppPaths; readonly artifacts?: InstalledArtifacts }

export function createContainer(options: ContainerOptions = {}): Container {
  const container = new Container()
  container.bind<AppPaths>(TYPES.paths).toConstantValue(options.paths ?? resolvePaths())
  container.bind<InstalledArtifacts>(TYPES.artifacts).toConstantValue(options.artifacts ?? resolveInstalledArtifacts())
  container.bind<GitHubApiClient>(GitHubApiClient).toConstantValue(new GitHubApiClient())

  container.bind<ConfigurationPort>(TYPES.configuration).toDynamicValue(context => new JsonConfigurationAdapter(context.get(TYPES.paths))).inSingletonScope()
  container.bind<CredentialPort>(TYPES.credentials).to(KeychainCredentialAdapter).inSingletonScope()
  container.bind<ContributionSourcePort>(TYPES.source).to(GitLabCalendarAdapter).inSingletonScope()
  container.bind<DestinationIdentityPort>(TYPES.identity).toDynamicValue(context => new GitHubDestinationIdentityAdapter(context.get(GitHubApiClient))).inSingletonScope()
  container.bind<MirrorRepositoryFactoryPort>(TYPES.mirrors).toDynamicValue(context => new GitMirrorRepositoryFactory(context.get(TYPES.paths), context.get(GitHubApiClient))).inSingletonScope()
  container.bind<NotificationPort>(TYPES.notifications).toDynamicValue(context => new MacNotificationAdapter(context.get<InstalledArtifacts>(TYPES.artifacts).helperPath, context.get<AppPaths>(TYPES.paths).cliLink)).inSingletonScope()
  container.bind<RunStatePort>(TYPES.state).toDynamicValue(context => new JsonRunStateAdapter(context.get<AppPaths>(TYPES.paths).stateFile)).inSingletonScope()
  container.bind<RunLockPort>(TYPES.lock).toDynamicValue(context => new FileRunLockAdapter(context.get<AppPaths>(TYPES.paths).lockFile)).inSingletonScope()
  container.bind<LogPort>(TYPES.log).toDynamicValue(context => new RotatingLogAdapter(context.get<AppPaths>(TYPES.paths).logFile, { maxBytes: 1_048_576, files: 5 })).inSingletonScope()
  container.bind<ClockPort>(TYPES.clock).to(SystemClockAdapter).inSingletonScope()
  container.bind<SchedulerPort>(TYPES.scheduler).toDynamicValue(context => new LaunchdSchedulerAdapter(context.get(TYPES.paths), context.get(TYPES.configuration), context.get(TYPES.artifacts))).inSingletonScope()
  container.bind<DiagnosticsPort>(TYPES.diagnostics).toDynamicValue(context => new SystemDiagnosticsAdapter(context.get(TYPES.configuration), context.get(TYPES.credentials), context.get(TYPES.source), context.get(GitHubApiClient))).inSingletonScope()
  container.bind<LogViewerPort>(TYPES.logViewer).toDynamicValue(context => new LogViewerAdapter(context.get<AppPaths>(TYPES.paths).logFile)).inSingletonScope()
  container.bind<CliIo>(TYPES.io).to(ConsoleIo).inSingletonScope()

  container.bind(ContributionSyncService).toDynamicValue(context => new ContributionSyncService(
    context.get(TYPES.configuration), context.get(TYPES.credentials), context.get(TYPES.source), context.get(TYPES.identity),
    context.get(TYPES.mirrors), context.get(TYPES.notifications), context.get(TYPES.state), context.get(TYPES.lock),
    context.get(TYPES.log), context.get(TYPES.clock)
  )).inSingletonScope()
  container.bind(ConfigurationService).toDynamicValue(context => new ConfigurationService(context.get(TYPES.configuration), context.get(TYPES.scheduler))).inSingletonScope()

  container.bind(ConfigurationCommandHandler).toDynamicValue(context => new ConfigurationCommandHandler(context.get(ConfigurationService), context.get(TYPES.credentials), context.get(TYPES.io)))
  container.bind(CredentialsCommandHandler).toDynamicValue(context => new CredentialsCommandHandler(context.get(TYPES.credentials), context.get(TYPES.io)))
  container.bind(DiagnosticsCommandHandler).toDynamicValue(context => new DiagnosticsCommandHandler(context.get(TYPES.diagnostics), context.get(TYPES.io)))
  container.bind(LogsCommandHandler).toDynamicValue(context => new LogsCommandHandler(context.get(TYPES.logViewer)))
  container.bind(ServiceCommandHandler).toDynamicValue(context => new ServiceCommandHandler(context.get(TYPES.scheduler), context.get(TYPES.io)))
  container.bind(SetupCommandHandler).toDynamicValue(context => new SetupCommandHandler(context.get(TYPES.configuration), context.get(TYPES.credentials), context.get(ContributionSyncService), context.get(TYPES.scheduler), context.get(TYPES.io)))
  container.bind(StatusCommandHandler).toDynamicValue(context => new StatusCommandHandler(context.get(TYPES.state), context.get(TYPES.io)))
  container.bind(SyncCommandHandler).toDynamicValue(context => new SyncCommandHandler(context.get(ContributionSyncService), context.get(TYPES.io)))
  container.bind(CliController).toDynamicValue(context => {
    const handlers: CommandHandler[] = [
      context.get(SetupCommandHandler), context.get(ConfigurationCommandHandler), context.get(CredentialsCommandHandler),
      context.get(SyncCommandHandler), context.get(StatusCommandHandler), context.get(DiagnosticsCommandHandler),
      context.get(LogsCommandHandler), context.get(ServiceCommandHandler)
    ]
    return new CliController(handlers, context.get(TYPES.io))
  }).inSingletonScope()
  return container
}
