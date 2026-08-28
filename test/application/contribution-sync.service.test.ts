import assert from 'node:assert/strict'
import test from 'node:test'

import { ContributionSyncService } from '../../src/application/contribution-sync.service.js'
import { SourceUnavailableError } from '../../src/application/errors.js'
import type {
  ClockPort,
  ConfigurationPort,
  ContributionSourcePort,
  CredentialPort,
  DestinationIdentityPort,
  LogPort,
  MirrorRepositoryFactoryPort,
  NotificationPort,
  RunLockPort,
  RunStatePort
} from '../../src/application/sync.ports.js'

function createService(overrides: Partial<{
  configuration: ConfigurationPort
  source: ContributionSourcePort
  mirrorFactory: MirrorRepositoryFactoryPort
  notifications: NotificationPort
  state: RunStatePort
  lock: RunLockPort
}> = {}): ContributionSyncService {
  const configuration: ConfigurationPort = overrides.configuration ?? {
    load: async () => ({
      schemaVersion: 1,
      calendarUrl: 'https://gitlab.example.com/users/alice/calendar.json',
      mirrorRepositoryUrl: 'https://github.com/alice/mirror.git',
      intervalMinutes: 60,
      lookbackDays: 365,
      timeZone: 'Europe/Moscow',
      limits: { perDay: 1_000, perRun: 20_000 },
      notifications: { enabled: true, networkFailureThreshold: 3 }
    }),
    save: async () => undefined,
    defaults: () => { throw new Error('not used') }
  }
  const credentials: CredentialPort = { get: async kind => `${kind}-secret`, set: async () => undefined, has: async () => true }
  const source: ContributionSourcePort = overrides.source ?? { load: async () => ({ '2026-08-28': 2 }) }
  const identity: DestinationIdentityPort = { resolve: async () => ({ name: 'Octocat', email: '42+octocat@users.noreply.github.com' }) }
  const mirrorFactory: MirrorRepositoryFactoryPort = overrides.mirrorFactory ?? {
    open: async () => ({
      readMirroredCounts: async () => ({ '2026-08-28': 1 }),
      createCommits: async plan => plan.reduce((sum, item) => sum + item.count, 0),
      push: async () => undefined,
      cleanup: async () => undefined
    })
  }
  const notifications: NotificationPort = overrides.notifications ?? { send: async () => undefined }
  const state: RunStatePort = overrides.state ?? {
    read: async () => ({ consecutiveNetworkFailures: 0, failureNotified: false, lastOutcome: 'never' }),
    recordFailure: async () => ({ notify: false }),
    recordSuccess: async () => ({ recovered: false })
  }
  const lock: RunLockPort = overrides.lock ?? { acquire: async () => true, release: async () => undefined }
  const log: LogPort = { info: async () => undefined, error: async () => undefined }
  const clock: ClockPort = { today: () => '2026-08-28' }

  return new ContributionSyncService(
    configuration,
    credentials,
    source,
    identity,
    mirrorFactory,
    notifications,
    state,
    lock,
    log,
    clock,
    { attempts: 3, delayMs: 0 }
  )
}

test('dry-run returns a plan without creating or pushing commits', async () => {
  let created = false
  let pushed = false
  let cleaned = false
  const service = createService({
    mirrorFactory: {
      open: async () => ({
        readMirroredCounts: async () => ({ '2026-08-28': 1 }),
        createCommits: async () => { created = true; return 1 },
        push: async () => { pushed = true },
        cleanup: async () => { cleaned = true }
      })
    }
  })

  assert.deepEqual(await service.execute({ dryRun: true }), { status: 'dry-run', commits: 1, days: 1 })
  assert.equal(created, false)
  assert.equal(pushed, false)
  assert.equal(cleaned, true)
})

test('applies the network notification threshold inside the service', async () => {
  let failures = 0
  const notices: string[] = []
  const service = createService({
    source: { load: async () => { throw new SourceUnavailableError('VPN unavailable') } },
    state: {
      read: async () => ({ consecutiveNetworkFailures: failures, failureNotified: false, lastOutcome: 'failure' }),
      recordFailure: async () => ({ notify: ++failures === 3 }),
      recordSuccess: async () => ({ recovered: false })
    },
    notifications: { send: async message => { notices.push(message) } }
  })

  await assert.rejects(service.execute({}), /VPN unavailable/)
  await assert.rejects(service.execute({}), /VPN unavailable/)
  await assert.rejects(service.execute({}), /VPN unavailable/)
  assert.deepEqual(notices, ['VPN unavailable'])
})

test('preserves a configuration load failure without trying to load it again', async () => {
  let loads = 0
  const service = createService({
    configuration: {
      load: async () => { loads += 1; throw new Error('configuration is invalid') },
      save: async () => undefined,
      defaults: () => { throw new Error('not used') }
    }
  })

  await assert.rejects(service.execute({}), /configuration is invalid/)
  assert.equal(loads, 1)
})

test('releases the run lock even when repository cleanup fails', async () => {
  let released = false
  const service = createService({
    mirrorFactory: {
      open: async () => ({
        readMirroredCounts: async () => ({ '2026-08-28': 2 }),
        createCommits: async () => 0,
        push: async () => undefined,
        cleanup: async () => { throw new Error('cleanup failed') }
      })
    },
    lock: { acquire: async () => true, release: async () => { released = true } }
  })

  await assert.rejects(service.execute({ dryRun: true }), /cleanup failed/)
  assert.equal(released, true)
})
