import type { DiagnosticsPort } from '../../../application/operations.ports.js'
import type { CliIo, CommandHandler } from '../command-handler.js'

export class DiagnosticsCommandHandler implements CommandHandler {
  constructor(private readonly diagnostics: DiagnosticsPort, private readonly io: CliIo) {}
  matches(args: readonly string[]): boolean { return args[0] === 'doctor' }
  async execute(): Promise<void> { this.io.write((await this.diagnostics.run()).join('\n')) }
}
