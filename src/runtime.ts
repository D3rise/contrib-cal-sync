import { spawn } from 'node:child_process'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

import { fetchCalendar } from './calendar.js'
import type { CliDependencies } from './cli.js'
import { defaultConfig, loadConfig, saveConfig, type AppConfig } from './config.js'
import { GitMirror } from './git.js'
import { deriveNoreplyEmail, getDefaultBranch, getGitHubIdentity, parseGitHubRepositoryUrl } from './github.js'
import { CredentialStore } from './keychain.js'
import { LaunchdManager } from './launchd.js'
import { RotatingLogger } from './logger.js'
import { MacNotifier } from './notifier.js'
import { resolvePaths, type AppPaths } from './paths.js'
import { runCommand } from './process.js'
import { RunLock, RunStateStore } from './state.js'
import { runSync as executeSync } from './sync.js'

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

export function todayInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find(value => value.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export async function activateAfterConfirmation(
  answer: string,
  push: () => Promise<void>,
  enable: () => Promise<void>
): Promise<boolean> {
  const confirmed = answer.trim().toLowerCase()
  if (confirmed !== 'y' && confirmed !== 'yes') return false
  await push()
  await enable()
  return true
}

async function promptHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.stdin.setRawMode === undefined) {
    const reader = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await reader.question(label)
    reader.close()
    return answer.trim()
  }
  process.stdout.write(label)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  return await new Promise<string>((resolve, reject) => {
    let value = ''
    const onData = (chunk: Buffer): void => {
      for (const byte of chunk) {
        if (byte === 3) {
          cleanup()
          reject(new Error('Input cancelled.'))
          return
        }
        if (byte === 10 || byte === 13) {
          cleanup()
          process.stdout.write('\n')
          resolve(value.trim())
          return
        }
        if (byte === 127 || byte === 8) value = value.slice(0, -1)
        else value += String.fromCharCode(byte)
      }
    }
    const cleanup = (): void => {
      process.stdin.off('data', onData)
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
    }
    process.stdin.on('data', onData)
  })
}

async function question(reader: ReturnType<typeof createInterface>, label: string, fallback: string): Promise<string> {
  const answer = (await reader.question(`${label} [${fallback}]: `)).trim()
  return answer === '' ? fallback : answer
}

function installedArtifacts(): { mainPath: string; helperPath: string } {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  return {
    mainPath: path.join(moduleDir, 'main.js'),
    helperPath: path.join(moduleDir, 'ContributionNotificationHelper.app')
  }
}

function launchd(paths: AppPaths, config: AppConfig): LaunchdManager {
  const artifacts = installedArtifacts()
  return new LaunchdManager(paths.launchAgentFile, {
    nodePath: process.execPath,
    cliPath: artifacts.mainPath,
    intervalMinutes: config.intervalMinutes,
    stdoutPath: path.join(paths.logDir, 'launchd.stdout.log'),
    stderrPath: path.join(paths.logDir, 'launchd.stderr.log')
  })
}

async function runApplicationSync(paths: AppPaths, dryRun: boolean) {
  const config = await loadConfig(paths)
  const credentials = new CredentialStore()
  const logger = new RotatingLogger(paths.logFile, { maxBytes: 1_048_576, files: 5 })
  const artifacts = installedArtifacts()
  const notifier = new MacNotifier(artifacts.helperPath, paths.cliLink)

  return executeSync({
    config,
    credentials,
    calendar: token => fetchCalendar(config.calendarUrl, token),
    identity: async token => {
      const identity = await getGitHubIdentity(token)
      return {
        name: config.gitIdentity?.name ?? identity.name ?? identity.login,
        email: config.gitIdentity?.email ?? deriveNoreplyEmail(identity)
      }
    },
    mirror: async token => {
      await mkdir(paths.cacheDir, { recursive: true, mode: 0o700 })
      const workDir = path.join(paths.cacheDir, `run-${process.pid}-${Date.now()}`)
      const askpass = await createAskpass(paths.root)
      const repository = parseGitHubRepositoryUrl(config.mirrorRepositoryUrl)
      const defaultBranch = await getDefaultBranch(repository, token)
      return GitMirror.clone({
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
    },
    notify: (message, retry) => notifier.send(message, retry),
    log: (message, context) => logger.info(message, context),
    state: new RunStateStore(paths.stateFile),
    lock: new RunLock(paths.lockFile),
    today: () => todayInTimeZone(new Date(), config.timeZone)
  }, { dryRun })
}

async function configureInteractive(paths: AppPaths): Promise<void> {
  let existing = defaultConfig()
  try {
    existing = await loadConfig(paths)
    await launchd(paths, existing).disable()
  } catch { /* first configuration or an unloaded service */ }
  const reader = createInterface({ input: process.stdin, output: process.stdout })
  const calendarUrl = await question(reader, 'Calendar JSON URL', existing.calendarUrl || 'https://gitlab.example.com/users/username/calendar.json')
  const mirrorRepositoryUrl = await question(reader, 'Private GitHub repository URL', existing.mirrorRepositoryUrl || 'https://github.com/username/contribution-mirror.git')
  const intervalMinutes = Number(await question(reader, 'Sync interval in minutes', String(existing.intervalMinutes)))
  const lookbackDays = Number(await question(reader, 'History lookback in days', String(existing.lookbackDays)))
  const timeZone = await question(reader, 'IANA time zone', existing.timeZone)
  reader.close()

  const credentials = new CredentialStore()
  const gitlabToken = await promptHidden('GitLab token: ')
  const githubToken = await promptHidden('GitHub token: ')
  const config = { ...existing, calendarUrl, mirrorRepositoryUrl, intervalMinutes, lookbackDays, timeZone }
  await saveConfig(paths, config)
  await credentials.set('gitlab', gitlabToken)
  await credentials.set('github', githubToken)

  const result = await runApplicationSync(paths, true)
  if (result.status !== 'skipped') console.log(`Dry run: ${result.commits} commits across ${result.days} ${result.days === 1 ? 'day' : 'days'}.`)
  const confirmation = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await confirmation.question('Create and push these commits now? [y/N]: ')).trim().toLowerCase()
  confirmation.close()
  const activated = await activateAfterConfirmation(
    answer,
    async () => { await runApplicationSync(paths, false) },
    async () => { await launchd(paths, config).enable() }
  )
  if (!activated) console.log('First push was not confirmed; the scheduled service remains disabled.')
}

async function doctor(paths: AppPaths): Promise<readonly string[]> {
  const results: string[] = []
  results.push(process.platform === 'darwin' ? 'Platform: OK' : 'Platform: macOS is required')
  results.push(Number(process.versions.node.split('.')[0]) >= 22 ? `Node.js ${process.versions.node}: OK` : `Node.js ${process.versions.node}: version 22 or newer is required`)
  try { await runCommand('git', ['--version']); results.push('Git: OK') } catch { results.push('Git: missing') }
  try { await runCommand('xcrun', ['--find', 'swiftc']); results.push('Swift toolchain: found') } catch { results.push('Swift toolchain: missing') }
  let config: AppConfig | undefined
  try { config = await loadConfig(paths); results.push('Configuration: OK') } catch (error) { results.push(`Configuration: ${error instanceof Error ? error.message : 'invalid'}`) }
  const credentials = new CredentialStore()
  const status = { gitlab: await credentials.has('gitlab'), github: await credentials.has('github') }
  results.push(`GitLab credential: ${status.gitlab ? 'configured' : 'missing'}`)
  results.push(`GitHub credential: ${status.github ? 'configured' : 'missing'}`)
  if (config !== undefined && status.gitlab) {
    try { await fetchCalendar(config.calendarUrl, await credentials.get('gitlab')); results.push('Contribution source: reachable') }
    catch (error) { results.push(`Contribution source: ${error instanceof Error ? error.message : 'failed'}`) }
  }
  if (status.github) {
    try { await getGitHubIdentity(await credentials.get('github')); results.push('GitHub API: reachable') }
    catch (error) { results.push(`GitHub API: ${error instanceof Error ? error.message : 'failed'}`) }
  }
  return results
}

async function showLogs(paths: AppPaths, follow: boolean): Promise<void> {
  if (!follow) {
    try { process.stdout.write(await readFile(paths.logFile, 'utf8')) } catch { process.stdout.write('No application logs yet.\n') }
    return
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn('/usr/bin/tail', ['-n', '100', '-f', paths.logFile], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', () => resolve())
  })
}

export function createCliDependencies(paths: AppPaths = resolvePaths()): CliDependencies {
  const credentials = new CredentialStore()
  const state = new RunStateStore(paths.stateFile)
  return {
    loadConfig: () => loadConfig(paths),
    configure: () => configureInteractive(paths),
    saveConfig: config => saveConfig(paths, config),
    credentialStatus: async () => ({ gitlab: await credentials.has('gitlab'), github: await credentials.has('github') }),
    setCredential: (kind, secret) => credentials.set(kind, secret),
    promptSecret: promptHidden,
    runSync: dryRun => runApplicationSync(paths, dryRun),
    readStatus: () => state.read(),
    service: async action => {
      const manager = launchd(paths, await loadConfig(paths))
      await manager[action]()
    },
    doctor: () => doctor(paths),
    logs: follow => showLogs(paths, follow),
    write: value => { process.stdout.write(`${value}\n`) }
  }
}
