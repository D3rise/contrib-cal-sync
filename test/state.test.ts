import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { RunLock, RunStateStore } from '../src/state.js'

test('notifies on the third network failure and once after recovery', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'contrib-cal-state-'))
  const store = new RunStateStore(path.join(root, 'state.json'))
  assert.equal((await store.recordFailure('network', 3)).notify, false)
  assert.equal((await store.recordFailure('network', 3)).notify, false)
  assert.equal((await store.recordFailure('network', 3)).notify, true)
  assert.equal((await store.recordFailure('network', 3)).notify, false)
  assert.equal((await store.recordSuccess()).recovered, true)
  assert.equal((await store.recordSuccess()).recovered, false)
})

test('notifies immediately for a permanent failure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'contrib-cal-state-'))
  const store = new RunStateStore(path.join(root, 'state.json'))
  assert.equal((await store.recordFailure('permanent', 3)).notify, true)
})

test('allows only one process to hold the run lock', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'contrib-cal-lock-'))
  const first = new RunLock(path.join(root, 'run.lock'))
  const second = new RunLock(path.join(root, 'run.lock'))
  assert.equal(await first.acquire(), true)
  assert.equal(await second.acquire(), false)
  await first.release()
  assert.equal(await second.acquire(), true)
  await second.release()
})
