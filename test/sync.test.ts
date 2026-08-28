import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { CalendarFetchError } from '../src/calendar.js'
import { RunLock, RunStateStore } from '../src/state.js'
import { runSync, type SyncDependencies } from '../src/sync.js'

function dependencies(root: string): SyncDependencies {
  return {
    config: {
      schemaVersion: 1,
      calendarUrl: 'https://gitlab.example.com/users/alice/calendar.json',
      mirrorRepositoryUrl: 'https://github.com/alice/mirror.git',
      intervalMinutes: 60,
      lookbackDays: 365,
      timeZone: 'Europe/Moscow',
      limits: { perDay: 1_000, perRun: 20_000 },
      notifications: { enabled: true, networkFailureThreshold: 3 }
    },
    credentials: { get: async kind => `${kind}-secret` },
    calendar: async () => ({ '2026-08-28': 2 }),
    identity: async () => ({ name: 'Octocat', email: '42+octocat@users.noreply.github.com' }),
    mirror: async () => ({
      readMirroredCounts: async () => ({ '2026-08-28': 1 }),
      createCommits: async plan => plan.reduce((sum, item) => sum + item.count, 0),
      push: async () => undefined
    }),
    notify: async () => undefined,
    log: async () => undefined,
    state: new RunStateStore(path.join(root, 'state.json')),
    lock: new RunLock(path.join(root, 'run.lock')),
    today: () => '2026-08-28',
    retryDelayMs: 0
  }
}

test('dry-run reports missing commits without creating or pushing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'contrib-cal-sync-'))
  const deps = dependencies(root)
  let created = false
  let pushed = false
  let cleaned = false
  deps.mirror = async () => ({
    readMirroredCounts: async () => ({ '2026-08-28': 1 }),
    createCommits: async () => { created = true; return 1 },
    push: async () => { pushed = true },
    cleanup: async () => { cleaned = true }
  })
  const result = await runSync(deps, { dryRun: true })
  assert.deepEqual(result, { status: 'dry-run', commits: 1, days: 1 })
  assert.equal(created, false)
  assert.equal(pushed, false)
  assert.equal(cleaned, true)
})

test('notifies only after the third consecutive source network failure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'contrib-cal-sync-'))
  const notices: string[] = []
  for (let run = 0; run < 3; run += 1) {
    const deps = dependencies(root)
    deps.calendar = async () => { throw new CalendarFetchError('VPN unavailable', true) }
    deps.notify = async message => { notices.push(message) }
    await assert.rejects(runSync(deps, {}), /VPN unavailable/)
  }
  assert.deepEqual(notices, ['VPN unavailable'])
})
