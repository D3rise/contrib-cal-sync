import type { CliIo, CommandHandler } from './command-handler.js'

export const usage = `Usage:
  contrib-cal-sync configure
  contrib-cal-sync config show|get <key>|set <key> <value>
  contrib-cal-sync credentials set <gitlab|github>|status
  contrib-cal-sync run [--dry-run]
  contrib-cal-sync status
  contrib-cal-sync doctor
  contrib-cal-sync logs [--follow]
  contrib-cal-sync service enable|disable|restart`

export class CliController {
  constructor(private readonly handlers: readonly CommandHandler[], private readonly io: CliIo) {}

  async execute(args: readonly string[]): Promise<number> {
    const handler = this.handlers.find(candidate => candidate.matches(args))
    if (handler === undefined) {
      this.io.write(usage)
      return 2
    }
    try {
      await handler.execute(args)
      return 0
    } catch (error) {
      this.io.write(`Error: ${error instanceof Error ? error.message : String(error)}`)
      return 1
    }
  }
}
