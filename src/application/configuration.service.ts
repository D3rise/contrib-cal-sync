import type { SchedulerPort } from './operations.ports.js'
import type { ConfigurationPort } from './sync.ports.js'
import type { AppConfig } from './sync.types.js'

export function getConfigValue(value: unknown, dottedKey: string): unknown {
  return dottedKey.split('.').reduce<unknown>(
    (current, key) => typeof current === 'object' && current !== null
      ? (current as Record<string, unknown>)[key]
      : undefined,
    value
  )
}

function replacement(current: unknown, value: string): unknown {
  if (typeof current === 'number') {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error('Value must be numeric.')
    return parsed
  }
  if (typeof current === 'boolean') {
    if (value !== 'true' && value !== 'false') throw new Error('Value must be true or false.')
    return value === 'true'
  }
  return value
}

export function replaceConfigValue(config: AppConfig, dottedKey: string, value: string): AppConfig {
  const keys = dottedKey.split('.')
  const clone = structuredClone(config) as unknown as Record<string, unknown>
  let cursor = clone
  for (const key of keys.slice(0, -1)) {
    const next = cursor[key]
    if (typeof next !== 'object' || next === null) throw new Error(`Unknown configuration key: ${dottedKey}`)
    cursor = next as Record<string, unknown>
  }
  const final = keys.at(-1)
  if (final === undefined || !(final in cursor)) throw new Error(`Unknown configuration key: ${dottedKey}`)
  cursor[final] = replacement(cursor[final], value)
  return clone as unknown as AppConfig
}

export class ConfigurationService {
  constructor(private readonly configuration: ConfigurationPort, private readonly scheduler: SchedulerPort) {}

  load(): Promise<AppConfig> { return this.configuration.load() }

  async set(key: string, value: string): Promise<void> {
    await this.configuration.save(replaceConfigValue(await this.configuration.load(), key, value))
    if (key === 'intervalMinutes') await this.scheduler.execute('restart')
  }
}
