import type { CredentialPort } from '../../../application/sync.ports.js'
import type { CliIo, CommandHandler } from '../command-handler.js'

export class CredentialsCommandHandler implements CommandHandler {
  constructor(private readonly credentials: CredentialPort, private readonly io: CliIo) {}
  matches(args: readonly string[]): boolean {
    return args[0] === 'credentials' && (
      args[1] === 'status' ||
      (args[1] === 'set' && (args[2] === 'gitlab' || args[2] === 'github'))
    )
  }
  async execute(args: readonly string[]): Promise<void> {
    const [, action, kind] = args
    if (action === 'status') {
      this.io.write(JSON.stringify({ gitlab: await this.credentials.has('gitlab'), github: await this.credentials.has('github') }, null, 2))
      return
    }
    if (action === 'set' && (kind === 'gitlab' || kind === 'github')) {
      await this.credentials.set(kind, await this.io.secret(`${kind} token: `))
      this.io.write(`${kind} credential updated.`)
      return
    }
    throw new Error('Invalid credentials command.')
  }
}
