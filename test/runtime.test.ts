import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

import { createAskpass } from '../src/infrastructure/git/git-mirror.repository.js'
import { todayInTimeZone } from '../src/infrastructure/system/system-clock.adapter.js'
import { activateAfterConfirmation } from '../src/presentation/cli/handlers/setup.handler.js'

const exec = promisify(execFile)

test('askpass returns a fixed username and reads the token only from its environment', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'contrib-cal-askpass-'))
  const script = await createAskpass(root)
  const username = await exec(script, ['Username for https://github.com'], { env: { ...process.env, CONTRIB_CAL_SYNC_GITHUB_TOKEN: 'top-secret' } })
  const password = await exec(script, ['Password for https://github.com'], { env: { ...process.env, CONTRIB_CAL_SYNC_GITHUB_TOKEN: 'top-secret' } })
  assert.equal(username.stdout, 'x-access-token')
  assert.equal(password.stdout, 'top-secret')
})

test('derives today from the configured time zone', () => {
  assert.equal(todayInTimeZone(new Date('2026-08-28T22:30:00Z'), 'Europe/Moscow'), '2026-08-29')
  assert.equal(todayInTimeZone(new Date('2026-08-28T22:30:00Z'), 'America/Los_Angeles'), '2026-08-28')
})

test('does not enable the service when the first push is not confirmed', async () => {
  let pushed = false
  let enabled = false
  assert.equal(await activateAfterConfirmation('no', async () => { pushed = true }, async () => { enabled = true }), false)
  assert.equal(pushed, false)
  assert.equal(enabled, false)
})

test('pushes before enabling the service after explicit confirmation', async () => {
  const order: string[] = []
  assert.equal(await activateAfterConfirmation('yes', async () => { order.push('push') }, async () => { order.push('enable') }), true)
  assert.deepEqual(order, ['push', 'enable'])
})
