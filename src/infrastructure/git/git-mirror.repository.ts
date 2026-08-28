import { appendFile, chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { MirrorRepositoryFactoryPort, MirrorRepositoryPort } from '../../application/sync.ports.js'
import type { AppConfig, CommitIdentity, MirrorPlanItem } from '../../application/sync.types.js'
import type { ContributionCalendar } from '../../domain/contribution-calendar.js'
import { contributionTimestamp } from '../../domain/contribution-time.js'
import type { GitHubApiClient } from '../github/github-api.client.js'
import type { AppPaths } from '../system/paths.js'
import { runCommand } from '../system/process-runner.js'

export interface GitMirrorOptions {
  readonly repositoryUrl: string
  readonly workDir: string
  readonly defaultBranch: string
  readonly environment?: NodeJS.ProcessEnv
}

const markerTrailer = 'Contrib-Cal-Sync: 1'

export class GitMirrorRepository implements MirrorRepositoryPort {
  private constructor(
    readonly workDir: string,
    private readonly defaultBranch: string,
    private readonly environment: NodeJS.ProcessEnv
  ) {}

  static async clone(options: GitMirrorOptions): Promise<GitMirrorRepository> {
    await runCommand('git', ['clone', '--no-tags', options.repositoryUrl, options.workDir], options.environment === undefined ? {} : { env: options.environment })
    const mirror = new GitMirrorRepository(options.workDir, options.defaultBranch, options.environment ?? process.env)
    if (await mirror.hasHead()) await mirror.git(['switch', options.defaultBranch])
    return mirror
  }

  private async git(args: readonly string[], env: NodeJS.ProcessEnv = this.environment): Promise<string> {
    return (await runCommand('git', args, { cwd: this.workDir, env })).stdout.trim()
  }

  private async hasHead(): Promise<boolean> {
    try {
      await this.git(['rev-parse', '--verify', 'HEAD'])
      return true
    } catch {
      return false
    }
  }

  async initializeEmptyRepository(): Promise<void> {
    if (await this.hasHead()) return
    await this.git(['symbolic-ref', 'HEAD', `refs/heads/${this.defaultBranch}`])
    const stateFile = path.join(this.workDir, '.contrib-cal-sync', 'state')
    await mkdir(path.dirname(stateFile), { recursive: true })
    await writeFile(stateFile, '# Managed by contrib-cal-sync.\n', 'utf8')
    await this.git(['add', '.contrib-cal-sync/state'])
    await this.git([
      '-c', 'user.name=Contribution Mirror',
      '-c', 'user.email=contrib-cal-sync@users.noreply.github.com',
      '-c', 'commit.gpgsign=false',
      'commit', '-m', 'chore: initialize contribution mirror'
    ])
  }

  async readMirroredCounts(): Promise<ContributionCalendar> {
    if (!await this.hasHead()) return {}
    const output = await this.git(['log', '--format=%aI%x1f%B%x1e'])
    const counts: Record<string, number> = {}
    for (const record of output.split('\x1e')) {
      const separator = record.indexOf('\x1f')
      if (separator === -1) continue
      const date = record.slice(0, separator).trim().slice(0, 10)
      const message = record.slice(separator + 1)
      if (!message.split(/\r?\n/).some(line => line.trim() === markerTrailer)) continue
      counts[date] = (counts[date] ?? 0) + 1
    }
    return counts
  }

  async createCommits(plan: readonly MirrorPlanItem[], identity: CommitIdentity, timeZone: string): Promise<number> {
    await this.initializeEmptyRepository()
    const statePath = path.join(this.workDir, '.contrib-cal-sync', 'state')
    await mkdir(path.dirname(statePath), { recursive: true })
    let created = 0
    for (const item of plan) {
      const timestamp = contributionTimestamp(item.date, timeZone)
      for (let index = 1; index <= item.count; index += 1) {
        await appendFile(statePath, `${item.date} ${Date.now()} ${index}\n`, 'utf8')
        await this.git(['add', '.contrib-cal-sync/state'])
        await this.git(
          ['-c', `user.name=${identity.name}`, '-c', `user.email=${identity.email}`, '-c', 'commit.gpgsign=false', 'commit', '-m', 'chore: mirror contribution', '-m', markerTrailer],
          { ...this.environment, GIT_AUTHOR_DATE: timestamp, GIT_COMMITTER_DATE: timestamp }
        )
        created += 1
      }
    }
    return created
  }

  async push(): Promise<void> {
    await this.git(['push', 'origin', `HEAD:refs/heads/${this.defaultBranch}`])
  }

  async cleanup(): Promise<void> {
    await rm(this.workDir, { recursive: true, force: true })
  }
}

export async function createAskpass(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const file = path.join(directory, 'github-askpass.sh')
  await writeFile(file, `#!/bin/sh
case "$1" in
  *Username*) printf '%s' 'x-access-token' ;;
  *) printf '%s' "$CONTRIB_CAL_SYNC_GITHUB_TOKEN" ;;
esac
`, { mode: 0o700 })
  await chmod(file, 0o700)
  return file
}

export class GitMirrorRepositoryFactory implements MirrorRepositoryFactoryPort {
  constructor(private readonly paths: AppPaths, private readonly github: GitHubApiClient) {}

  async open(config: AppConfig, token: string): Promise<MirrorRepositoryPort> {
    await mkdir(this.paths.cacheDir, { recursive: true, mode: 0o700 })
    const workDir = path.join(this.paths.cacheDir, `run-${process.pid}-${Date.now()}`)
    const askpass = await createAskpass(this.paths.root)
    const defaultBranch = await this.github.defaultBranch(config.mirrorRepositoryUrl, token)
    return GitMirrorRepository.clone({
      repositoryUrl: config.mirrorRepositoryUrl,
      workDir,
      defaultBranch,
      environment: {
        ...process.env,
        CONTRIB_CAL_SYNC_GITHUB_TOKEN: token,
        GIT_ASKPASS: askpass,
        GIT_ASKPASS_REQUIRE: 'force',
        GIT_TERMINAL_PROMPT: '0'
      }
    })
  }
}
