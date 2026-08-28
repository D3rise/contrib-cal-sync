import type { ContributionSyncService } from '../../../application/contribution-sync.service.js'
import type { SchedulerPort } from '../../../application/operations.ports.js'
import type { ConfigurationPort, CredentialPort } from '../../../application/sync.ports.js'
import type { AppConfig } from '../../../application/sync.types.js'
import type { CliIo, CommandHandler } from '../command-handler.js'

export async function activateAfterConfirmation(answer: string, push: () => Promise<void>, enable: () => Promise<void>): Promise<boolean> {
  const confirmed = answer.trim().toLowerCase()
  if (confirmed !== 'y' && confirmed !== 'yes') return false
  await push()
  await enable()
  return true
}

export class SetupCommandHandler implements CommandHandler {
  constructor(
    private readonly configuration: ConfigurationPort,
    private readonly credentials: CredentialPort,
    private readonly sync: ContributionSyncService,
    private readonly scheduler: SchedulerPort,
    private readonly io: CliIo
  ) {}
  matches(args: readonly string[]): boolean { return args[0] === 'configure' }
  async execute(): Promise<void> {
    let existing = this.configuration.defaults()
    try { existing = await this.configuration.load(); await this.scheduler.execute('disable') } catch { /* first setup */ }
    const config: AppConfig = {
      ...existing,
      calendarUrl: await this.io.question('Calendar JSON URL', existing.calendarUrl || 'https://gitlab.example.com/users/username/calendar.json'),
      mirrorRepositoryUrl: await this.io.question('Private GitHub repository URL', existing.mirrorRepositoryUrl || 'https://github.com/username/contribution-mirror.git'),
      intervalMinutes: Number(await this.io.question('Sync interval in minutes', String(existing.intervalMinutes))),
      lookbackDays: Number(await this.io.question('History lookback in days', String(existing.lookbackDays))),
      timeZone: await this.io.question('IANA time zone', existing.timeZone)
    }
    await this.configuration.save(config)
    await this.credentials.set('gitlab', await this.io.secret('GitLab token: '))
    await this.credentials.set('github', await this.io.secret('GitHub token: '))
    const plan = await this.sync.execute({ dryRun: true })
    if (plan.status !== 'skipped') this.io.write(`Dry run: ${plan.commits} commits across ${plan.days} ${plan.days === 1 ? 'day' : 'days'}.`)
    const activated = await activateAfterConfirmation(
      await this.io.question('Create and push these commits now? [y/N]: '),
      async () => { await this.sync.execute({}) },
      async () => { await this.scheduler.execute('enable') }
    )
    if (!activated) this.io.write('First push was not confirmed; the scheduled service remains disabled.')
    this.io.write('Configuration completed.')
  }
}
