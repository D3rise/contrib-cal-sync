import { getConfigValue } from '../../../application/configuration.service.js'
import type { ConfigurationService } from '../../../application/configuration.service.js'
import type { CredentialPort } from '../../../application/sync.ports.js'
import type { CliIo, CommandHandler } from '../command-handler.js'

export class ConfigurationCommandHandler implements CommandHandler {
  constructor(private readonly configs: ConfigurationService, private readonly credentials: CredentialPort, private readonly io: CliIo) {}
  matches(args: readonly string[]): boolean {
    return args[0] === 'config' && (
      args[1] === 'show' ||
      (args[1] === 'get' && args[2] !== undefined) ||
      (args[1] === 'set' && args[2] !== undefined && args[3] !== undefined)
    )
  }
  async execute(args: readonly string[]): Promise<void> {
    const [, action, key, value] = args
    if (action === 'show') {
      const [config, gitlab, github] = await Promise.all([
        this.configs.load(), this.credentials.has('gitlab'), this.credentials.has('github')
      ])
      this.io.write(JSON.stringify({ ...config, credentials: { gitlab: gitlab ? 'configured' : 'missing', github: github ? 'configured' : 'missing' } }, null, 2))
      return
    }
    if (action === 'get' && key !== undefined) { this.io.write(JSON.stringify(getConfigValue(await this.configs.load(), key))); return }
    if (action === 'set' && key !== undefined && value !== undefined) { await this.configs.set(key, value); this.io.write('Configuration updated.'); return }
    throw new Error('Invalid config command.')
  }
}
