import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ConfigurationPort } from '../../application/sync.ports.js'
import type { AppConfig } from '../../application/sync.types.js'
import type { AppPaths } from '../system/paths.js'

export function defaultConfig(): AppConfig {
  return {
    schemaVersion: 1,
    calendarUrl: '',
    calendarAuth: 'pat',
    mirrorRepositoryUrl: '',
    intervalMinutes: 60,
    lookbackDays: 365,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    limits: { perDay: 1_000, perRun: 20_000 },
    notifications: { enabled: true, networkFailureThreshold: 3 }
  }
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }
  return value as Record<string, unknown>
}

function integer(value: unknown, name: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
  }
  return value as number
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required`)
  return value.trim()
}

function httpsUrl(value: unknown, name: string): string {
  const raw = requiredString(value, name)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL`)
  }
  if (url.protocol !== 'https:') throw new Error(`${name} must be a valid HTTPS URL`)
  return url.toString()
}

function timeZone(value: unknown): string {
  const zone = requiredString(value, 'timeZone')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format()
  } catch {
    throw new Error('timeZone must be a valid IANA time zone')
  }
  return zone
}

export function parseConfig(value: unknown): AppConfig {
  const input = object(value, 'config')
  const limits = object(input.limits, 'limits')
  const notifications = object(input.notifications, 'notifications')
  if (typeof input.intervalMinutes === 'number' && input.intervalMinutes < 15) {
    throw new Error('intervalMinutes must be at least 15')
  }
  const intervalMinutes = integer(input.intervalMinutes, 'intervalMinutes', 15, 43_200)
  const repositoryUrl = httpsUrl(input.mirrorRepositoryUrl, 'mirrorRepositoryUrl')
  if (new URL(repositoryUrl).hostname.toLowerCase() !== 'github.com') {
    throw new Error('mirrorRepositoryUrl must point to GitHub')
  }
  if (input.schemaVersion !== 1) throw new Error('schemaVersion must be 1')
  const calendarAuth = input.calendarAuth ?? 'pat'
  if (calendarAuth !== 'pat' && calendarAuth !== 'session') throw new Error('calendarAuth must be pat or session')

  const base: AppConfig = {
    schemaVersion: 1,
    calendarUrl: httpsUrl(input.calendarUrl, 'calendarUrl'),
    calendarAuth,
    mirrorRepositoryUrl: repositoryUrl,
    intervalMinutes,
    lookbackDays: integer(input.lookbackDays, 'lookbackDays', 1, 1_095),
    timeZone: timeZone(input.timeZone),
    limits: {
      perDay: integer(limits.perDay, 'limits.perDay', 1, 1_000_000),
      perRun: integer(limits.perRun, 'limits.perRun', 1, 10_000_000)
    },
    notifications: {
      enabled: typeof notifications.enabled === 'boolean' ? notifications.enabled : true,
      networkFailureThreshold: integer(notifications.networkFailureThreshold, 'notifications.networkFailureThreshold', 1, 100)
    }
  }

  if (input.gitIdentity === undefined) return base

  {
    const identity = object(input.gitIdentity, 'gitIdentity')
    const name = identity.name === undefined ? undefined : requiredString(identity.name, 'gitIdentity.name')
    const email = identity.email === undefined ? undefined : requiredString(identity.email, 'gitIdentity.email')
    return {
      ...base,
      gitIdentity: { ...(name === undefined ? {} : { name }), ...(email === undefined ? {} : { email }) }
    }
  }
}

export async function loadConfig(paths: AppPaths): Promise<AppConfig> {
  return parseConfig(JSON.parse(await readFile(paths.configFile, 'utf8')) as unknown)
}

export async function saveConfig(paths: AppPaths, value: unknown): Promise<void> {
  const config = parseConfig(value)
  await mkdir(path.dirname(paths.configFile), { recursive: true, mode: 0o700 })
  const temporary = `${paths.configFile}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, paths.configFile)
  await chmod(paths.configFile, 0o600)
}

export class JsonConfigurationAdapter implements ConfigurationPort {
  constructor(private readonly paths: AppPaths) {}

  load(): Promise<AppConfig> { return loadConfig(this.paths) }
  save(config: AppConfig): Promise<void> { return saveConfig(this.paths, config) }
  defaults(): AppConfig { return defaultConfig() }
}
