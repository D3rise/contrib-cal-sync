#!/usr/bin/env node
import type { AppConfig } from './config.js'
import type { RunState } from './state.js'
import type { SyncResult } from './sync.js'

export interface CliDependencies {
  loadConfig(): Promise<AppConfig>
  configure(): Promise<void>
  saveConfig(config: AppConfig): Promise<void>
  credentialStatus(): Promise<{ gitlab: boolean; github: boolean }>
  setCredential(kind: 'gitlab' | 'github', secret: string): Promise<void>
  promptSecret(label: string): Promise<string>
  runSync(dryRun: boolean): Promise<SyncResult>
  readStatus(): Promise<Partial<RunState>>
  service(action: 'enable' | 'disable' | 'restart'): Promise<void>
  doctor(): Promise<readonly string[]>
  logs(follow: boolean): Promise<void>
  write(value: string): void
}

const usage = `Usage:
  contrib-cal-sync configure
  contrib-cal-sync config show|get <key>|set <key> <value>
  contrib-cal-sync credentials set <gitlab|github>|status
  contrib-cal-sync run [--dry-run]
  contrib-cal-sync status
  contrib-cal-sync doctor
  contrib-cal-sync logs [--follow]
  contrib-cal-sync service enable|disable|restart`

function getValue(value: unknown, dottedKey: string): unknown {
  return dottedKey.split('.').reduce<unknown>((current, key) => typeof current === 'object' && current !== null ? (current as Record<string, unknown>)[key] : undefined, value)
}

function parseReplacement(current: unknown, replacement: string): unknown {
  if (typeof current === 'number') {
    const number = Number(replacement)
    if (!Number.isFinite(number)) throw new Error('Value must be numeric.')
    return number
  }
  if (typeof current === 'boolean') {
    if (replacement !== 'true' && replacement !== 'false') throw new Error('Value must be true or false.')
    return replacement === 'true'
  }
  return replacement
}

function setValue(config: AppConfig, dottedKey: string, replacement: string): AppConfig {
  const keys = dottedKey.split('.')
  const clone = structuredClone(config) as unknown as Record<string, unknown>
  let cursor = clone
  for (const key of keys.slice(0, -1)) {
    const next = cursor[key]
    if (typeof next !== 'object' || next === null) throw new Error(`Unknown configuration key: ${dottedKey}`)
    cursor = next as Record<string, unknown>
  }
  const final = keys.at(-1)!
  if (!(final in cursor)) throw new Error(`Unknown configuration key: ${dottedKey}`)
  cursor[final] = parseReplacement(cursor[final], replacement)
  return clone as unknown as AppConfig
}

export async function runCli(args: readonly string[], dependencies: CliDependencies): Promise<number> {
  const [command, subcommand, ...rest] = args
  try {
    if (command === 'configure') {
      await dependencies.configure()
      dependencies.write('Configuration completed.')
      return 0
    }
    if (command === 'config' && subcommand === 'show') {
      const [config, status] = await Promise.all([dependencies.loadConfig(), dependencies.credentialStatus()])
      dependencies.write(JSON.stringify({ ...config, credentials: { gitlab: status.gitlab ? 'configured' : 'missing', github: status.github ? 'configured' : 'missing' } }, null, 2))
      return 0
    }
    if (command === 'config' && subcommand === 'get' && rest[0] !== undefined) {
      dependencies.write(JSON.stringify(getValue(await dependencies.loadConfig(), rest[0])))
      return 0
    }
    if (command === 'config' && subcommand === 'set' && rest[0] !== undefined && rest[1] !== undefined) {
      const config = setValue(await dependencies.loadConfig(), rest[0], rest[1])
      await dependencies.saveConfig(config)
      if (rest[0] === 'intervalMinutes') await dependencies.service('restart')
      dependencies.write('Configuration updated.')
      return 0
    }
    if (command === 'credentials' && subcommand === 'status') {
      dependencies.write(JSON.stringify(await dependencies.credentialStatus(), null, 2))
      return 0
    }
    if (command === 'credentials' && subcommand === 'set' && (rest[0] === 'gitlab' || rest[0] === 'github')) {
      await dependencies.setCredential(rest[0], await dependencies.promptSecret(`${rest[0]} token: `))
      dependencies.write(`${rest[0]} credential updated.`)
      return 0
    }
    if (command === 'run') {
      const result = await dependencies.runSync(args.includes('--dry-run'))
      if (result.status === 'skipped') dependencies.write('A sync is already running.')
      else dependencies.write(`${result.status === 'dry-run' ? 'Dry run' : 'Sync'}: ${result.commits} commits across ${result.days} ${result.days === 1 ? 'day' : 'days'}.`)
      return 0
    }
    if (command === 'status') {
      dependencies.write(JSON.stringify(await dependencies.readStatus(), null, 2))
      return 0
    }
    if (command === 'doctor') {
      dependencies.write((await dependencies.doctor()).join('\n'))
      return 0
    }
    if (command === 'logs') {
      await dependencies.logs(args.includes('--follow'))
      return 0
    }
    if (command === 'service' && (subcommand === 'enable' || subcommand === 'disable' || subcommand === 'restart')) {
      await dependencies.service(subcommand)
      dependencies.write(`Service ${subcommand} completed.`)
      return 0
    }
    dependencies.write(usage)
    return 2
  } catch (error) {
    dependencies.write(`Error: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}
