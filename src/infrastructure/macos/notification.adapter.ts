import type { NotificationPort } from '../../application/sync.ports.js'
import { runCommand } from '../system/process-runner.js'

export type NotificationRunner = (executable: string, args: readonly string[]) => Promise<void>

const defaultRunner: NotificationRunner = async (executable, args) => { await runCommand(executable, args) }

export class MacNotificationAdapter implements NotificationPort {
  constructor(
    private readonly appPath: string,
    private readonly cliPath: string,
    private readonly runner: NotificationRunner = defaultRunner
  ) {}

  async send(body: string, retry: boolean): Promise<void> {
    const args = [
      '-n', '-g', this.appPath, '--args', 'notify',
      '--title', 'Contribution Calendar Mirror', '--body', body
    ]
    if (retry) args.push('--retry-command', this.cliPath)
    await this.runner('/usr/bin/open', args)
  }
}
