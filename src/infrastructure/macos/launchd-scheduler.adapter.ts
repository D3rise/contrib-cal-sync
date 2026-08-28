import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SchedulerPort, ServiceAction } from '../../application/operations.ports.js'
import type { ConfigurationPort } from '../../application/sync.ports.js'
import type { AppPaths } from '../system/paths.js'
import { LaunchdManager } from './launchd.adapter.js'

export interface InstalledArtifacts {
  readonly mainPath: string
  readonly helperPath: string
}

export function resolveInstalledArtifacts(moduleUrl: string = import.meta.url): InstalledArtifacts {
  const moduleDir = path.dirname(fileURLToPath(moduleUrl))
  return {
    mainPath: path.resolve(moduleDir, '..', '..', 'main.js'),
    helperPath: path.resolve(moduleDir, '..', '..', 'ContributionNotificationHelper.app')
  }
}

export class LaunchdSchedulerAdapter implements SchedulerPort {
  constructor(
    private readonly paths: AppPaths,
    private readonly configuration: ConfigurationPort,
    private readonly artifacts: InstalledArtifacts
  ) {}

  async execute(action: ServiceAction): Promise<void> {
    const config = await this.configuration.load()
    const manager = new LaunchdManager(this.paths.launchAgentFile, {
      nodePath: process.execPath,
      cliPath: this.artifacts.mainPath,
      intervalMinutes: config.intervalMinutes,
      stdoutPath: path.join(this.paths.logDir, 'launchd.stdout.log'),
      stderrPath: path.join(this.paths.logDir, 'launchd.stderr.log')
    })
    await manager[action]()
  }
}
