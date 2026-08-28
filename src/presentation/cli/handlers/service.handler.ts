import type { SchedulerPort, ServiceAction } from '../../../application/operations.ports.js'
import type { CliIo, CommandHandler } from '../command-handler.js'

export class ServiceCommandHandler implements CommandHandler {
  constructor(private readonly scheduler: SchedulerPort, private readonly io: CliIo) {}
  matches(args: readonly string[]): boolean {
    return args[0] === 'service' && (args[1] === 'enable' || args[1] === 'disable' || args[1] === 'restart')
  }
  async execute(args: readonly string[]): Promise<void> {
    const action = args[1] as ServiceAction
    await this.scheduler.execute(action)
    this.io.write(`Service ${action} completed.`)
  }
}
