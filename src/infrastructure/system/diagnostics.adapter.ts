import type { DiagnosticsPort } from '../../application/operations.ports.js'
import type { ConfigurationPort, ContributionSourcePort, CredentialPort } from '../../application/sync.ports.js'
import type { GitHubApiClient } from '../github/github-api.client.js'
import { runCommand } from './process-runner.js'

export class SystemDiagnosticsAdapter implements DiagnosticsPort {
  constructor(
    private readonly configuration: ConfigurationPort,
    private readonly credentials: CredentialPort,
    private readonly source: ContributionSourcePort,
    private readonly github: GitHubApiClient
  ) {}

  async run(): Promise<readonly string[]> {
    const results: string[] = []
    results.push(process.platform === 'darwin' ? 'Platform: OK' : 'Platform: macOS is required')
    results.push(Number(process.versions.node.split('.')[0]) >= 22 ? `Node.js ${process.versions.node}: OK` : `Node.js ${process.versions.node}: version 22 or newer is required`)
    try { await runCommand('git', ['--version']); results.push('Git: OK') } catch { results.push('Git: missing') }
    try { await runCommand('xcrun', ['--find', 'swiftc']); results.push('Swift toolchain: found') } catch { results.push('Swift toolchain: missing') }
    let config
    try { config = await this.configuration.load(); results.push('Configuration: OK') } catch (error) { results.push(`Configuration: ${error instanceof Error ? error.message : 'invalid'}`) }
    const gitlab = await this.credentials.has('gitlab')
    const github = await this.credentials.has('github')
    results.push(`GitLab credential: ${gitlab ? 'configured' : 'missing'}`)
    results.push(`GitHub credential: ${github ? 'configured' : 'missing'}`)
    if (config !== undefined && gitlab) {
      try { await this.source.load(config, await this.credentials.get('gitlab')); results.push('Contribution source: reachable') }
      catch (error) { results.push(`Contribution source: ${error instanceof Error ? error.message : 'failed'}`) }
    }
    if (github) {
      try { await this.github.identity(await this.credentials.get('github')); results.push('GitHub API: reachable') }
      catch (error) { results.push(`GitHub API: ${error instanceof Error ? error.message : 'failed'}`) }
    }
    return results
  }
}
