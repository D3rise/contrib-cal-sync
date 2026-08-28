import type { ContributionSyncService } from '../../../application/contribution-sync.service.js'
import type { CliIo, CommandHandler } from '../command-handler.js'

export class SyncCommandHandler implements CommandHandler {
  constructor(private readonly sync: ContributionSyncService, private readonly io: CliIo) {}
  matches(args: readonly string[]): boolean { return args[0] === 'run' }
  async execute(args: readonly string[]): Promise<void> {
    const result = await this.sync.execute({ dryRun: args.includes('--dry-run') })
    if (result.status === 'skipped') { this.io.write('A sync is already running.'); return }
    const label = result.status === 'dry-run' ? 'Dry run' : 'Sync'
    this.io.write(`${label}: ${result.commits} commits across ${result.days} ${result.days === 1 ? 'day' : 'days'}.`)
  }
}
