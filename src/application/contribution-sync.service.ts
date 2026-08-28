import { createMirrorPlan } from '../domain/reconciliation.js'
import { SourceUnavailableError } from './errors.js'
import { retryTransient, type RetryPolicy } from './retry.js'
import type {
  ClockPort,
  ConfigurationPort,
  ContributionSourcePort,
  CredentialPort,
  DestinationIdentityPort,
  LogPort,
  MirrorRepositoryFactoryPort,
  MirrorRepositoryPort,
  NotificationPort,
  RunLockPort,
  RunStatePort
} from './sync.ports.js'
import type { AppConfig, SyncResult } from './sync.types.js'

export class ContributionSyncService {
  constructor(
    private readonly configuration: ConfigurationPort,
    private readonly credentials: CredentialPort,
    private readonly source: ContributionSourcePort,
    private readonly identity: DestinationIdentityPort,
    private readonly mirrors: MirrorRepositoryFactoryPort,
    private readonly notifications: NotificationPort,
    private readonly state: RunStatePort,
    private readonly lock: RunLockPort,
    private readonly log: LogPort,
    private readonly clock: ClockPort,
    private readonly retryPolicy: RetryPolicy = { attempts: 3, delayMs: 1_000 }
  ) {}

  async execute(options: { readonly dryRun?: boolean }): Promise<SyncResult> {
    if (!await this.lock.acquire()) return { status: 'skipped', reason: 'locked' }
    let mirror: MirrorRepositoryPort | undefined
    let config: AppConfig | undefined
    try {
      const loadedConfig = await this.configuration.load()
      config = loadedConfig
      const [sourceToken, destinationToken] = await Promise.all([
        this.credentials.get('gitlab'),
        this.credentials.get('github')
      ])
      const sourceCalendar = await retryTransient(() => this.source.load(loadedConfig, sourceToken), this.retryPolicy)
      const commitIdentity = await this.identity.resolve(loadedConfig, destinationToken)
      mirror = await this.mirrors.open(loadedConfig, destinationToken)
      const plan = createMirrorPlan(
        sourceCalendar,
        await mirror.readMirroredCounts(),
        loadedConfig.limits,
        this.clock.today(loadedConfig.timeZone),
        loadedConfig.lookbackDays
      )
      const commits = plan.reduce((total, item) => total + item.count, 0)

      if (!options.dryRun && commits > 0) {
        await mirror.createCommits(plan, commitIdentity, loadedConfig.timeZone)
        await mirror.push()
      }

      if (!options.dryRun) {
        const { recovered } = await this.state.recordSuccess(commits)
        if (recovered && loadedConfig.notifications.enabled) {
          await this.notifications.send('Contribution mirroring recovered successfully.', false)
        }
      }
      await this.log.info(options.dryRun ? 'Dry run completed.' : 'Sync completed.', { commits, days: plan.length })
      return { status: options.dryRun ? 'dry-run' : 'success', commits, days: plan.length }
    } catch (error) {
      const network = error instanceof SourceUnavailableError
      const message = error instanceof Error ? error.message : 'Sync failed.'
      const threshold = config?.notifications.networkFailureThreshold ?? 1
      const notificationsEnabled = config?.notifications.enabled ?? true
      const { notify } = await this.state.recordFailure(network ? 'network' : 'permanent', threshold, message)
      await this.log.error('Sync failed.', { kind: network ? 'network' : 'permanent', message })
      if (notify && notificationsEnabled) await this.notifications.send(message, true)
      throw error
    } finally {
      try {
        await mirror?.cleanup()
      } finally {
        await this.lock.release()
      }
    }
  }
}
