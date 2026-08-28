import type { RunStatePort } from '../../../application/sync.ports.js'
import type { CliIo, CommandHandler } from '../command-handler.js'

export class StatusCommandHandler implements CommandHandler {
  constructor(private readonly state: RunStatePort, private readonly io: CliIo) {}
  matches(args: readonly string[]): boolean { return args[0] === 'status' }
  async execute(): Promise<void> { this.io.write(JSON.stringify(await this.state.read(), null, 2)) }
}
