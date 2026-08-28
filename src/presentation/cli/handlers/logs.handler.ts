import type { LogViewerPort } from '../../../application/operations.ports.js'
import type { CommandHandler } from '../command-handler.js'

export class LogsCommandHandler implements CommandHandler {
  constructor(private readonly logs: LogViewerPort) {}
  matches(args: readonly string[]): boolean { return args[0] === 'logs' }
  execute(args: readonly string[]): Promise<void> { return this.logs.show(args.includes('--follow')) }
}
