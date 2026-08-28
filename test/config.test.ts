import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { defaultConfig, loadConfig, parseConfig, saveConfig } from '../src/config.js'
import { resolvePaths } from '../src/paths.js'

const validConfig = {
  ...defaultConfig(),
  calendarUrl: 'https://gitlab.example.com/users/alice/calendar.json',
  mirrorRepositoryUrl: 'https://github.com/alice/contribution-mirror.git',
  timeZone: 'Europe/Moscow'
}

test('provides the agreed safe defaults', () => {
  const config = defaultConfig()
  assert.equal(config.intervalMinutes, 60)
  assert.equal(config.lookbackDays, 365)
  assert.deepEqual(config.limits, { perDay: 1_000, perRun: 20_000 })
  assert.deepEqual(config.notifications, { enabled: true, networkFailureThreshold: 3 })
})

test('rejects an interval shorter than fifteen minutes', () => {
  assert.throws(() => parseConfig({ ...validConfig, intervalMinutes: 14 }), /at least 15/)
})

test('rejects an invalid IANA time zone', () => {
  assert.throws(() => parseConfig({ ...validConfig, timeZone: 'Moon/Sea' }), /timeZone/)
})

test('rejects non-HTTPS service URLs', () => {
  assert.throws(() => parseConfig({ ...validConfig, calendarUrl: 'http://gitlab.example.com/calendar.json' }), /HTTPS/)
})

test('rejects a repository outside github.com', () => {
  assert.throws(() => parseConfig({ ...validConfig, mirrorRepositoryUrl: 'https://example.com/alice/repo.git' }), /GitHub/)
})

test('saves configuration atomically with owner-only permissions', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'contrib-cal-config-'))
  const paths = resolvePaths({ CONTRIB_CAL_SYNC_HOME: home })

  await saveConfig(paths, validConfig)
  await chmod(paths.configFile, 0o600)

  assert.deepEqual(await loadConfig(paths), validConfig)
  assert.equal((await stat(paths.configFile)).mode & 0o777, 0o600)
  assert.doesNotMatch(await readFile(paths.configFile, 'utf8'), /token/i)
})
