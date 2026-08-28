import { CalendarFetchError, type ContributionCalendar } from './calendar.js'
import type { AppConfig } from './config.js'
import type { CommitIdentity } from './git.js'
import { planMirror, type MirrorPlanItem } from './reconcile.js'
import { withRetry } from './retry.js'
import type { RunLock, RunStateStore } from './state.js'

interface MirrorSession {
  readMirroredCounts(): Promise<ContributionCalendar>
  createCommits(plan: readonly MirrorPlanItem[], identity: CommitIdentity, timeZone: string): Promise<number>
  push(): Promise<void>
  cleanup?(): Promise<void>
}

export interface SyncDependencies {
  config: AppConfig
  credentials: { get(kind: 'gitlab' | 'github'): Promise<string> }
  calendar: (token: string) => Promise<ContributionCalendar>
  identity: (token: string) => Promise<CommitIdentity>
  mirror: (token: string) => Promise<MirrorSession>
  notify: (message: string, retry: boolean) => Promise<void>
  log: (message: string, context?: unknown) => Promise<void>
  state: RunStateStore
  lock: RunLock
  today: () => string
  retryDelayMs?: number
}

export type SyncResult =
  | { readonly status: 'skipped'; readonly reason: 'locked' }
  | { readonly status: 'dry-run' | 'success'; readonly commits: number; readonly days: number }

export async function runSync(dependencies: SyncDependencies, options: { readonly dryRun?: boolean }): Promise<SyncResult> {
  if (!await dependencies.lock.acquire()) return { status: 'skipped', reason: 'locked' }
  let activeMirror: MirrorSession | undefined
  try {
    const [gitlabToken, githubToken] = await Promise.all([
      dependencies.credentials.get('gitlab'),
      dependencies.credentials.get('github')
    ])
    const source = await withRetry(() => dependencies.calendar(gitlabToken), {
      attempts: 3,
      delayMs: dependencies.retryDelayMs ?? 1_000,
      isTransient: error => error instanceof CalendarFetchError && error.transient
    })
    const [identity, mirror] = await Promise.all([
      dependencies.identity(githubToken),
      dependencies.mirror(githubToken)
    ])
    activeMirror = mirror
    const plan = planMirror(source, await mirror.readMirroredCounts(), dependencies.config.limits, dependencies.today(), dependencies.config.lookbackDays)
    const commits = plan.reduce((total, item) => total + item.count, 0)

    if (!options.dryRun && commits > 0) {
      await mirror.createCommits(plan, identity, dependencies.config.timeZone)
      await mirror.push()
    }

    if (!options.dryRun) {
      const { recovered } = await dependencies.state.recordSuccess(commits)
      if (recovered && dependencies.config.notifications.enabled) await dependencies.notify('Contribution mirroring recovered successfully.', false)
    }
    await dependencies.log(options.dryRun ? 'Dry run completed.' : 'Sync completed.', { commits, days: plan.length })
    return { status: options.dryRun ? 'dry-run' : 'success', commits, days: plan.length }
  } catch (error) {
    const network = error instanceof CalendarFetchError && error.transient
    const message = error instanceof Error ? error.message : 'Sync failed.'
    const { notify } = await dependencies.state.recordFailure(network ? 'network' : 'permanent', dependencies.config.notifications.networkFailureThreshold, message)
    await dependencies.log('Sync failed.', { kind: network ? 'network' : 'permanent', message })
    if (notify && dependencies.config.notifications.enabled) await dependencies.notify(message, true)
    throw error
  } finally {
    await activeMirror?.cleanup?.()
    await dependencies.lock.release()
  }
}
