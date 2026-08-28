import assert from 'node:assert/strict'
import test from 'node:test'

import { SourceUnavailableError } from '../src/application/errors.js'
import { retryTransient } from '../src/application/retry.js'

test('retries a transient operation twice before succeeding', async () => {
  let attempts = 0
  const result = await retryTransient(async () => {
    attempts += 1
    if (attempts < 3) throw new SourceUnavailableError('offline')
    return 'ok'
  }, { attempts: 3, delayMs: 0 })
  assert.equal(result, 'ok')
  assert.equal(attempts, 3)
})

test('does not retry a permanent operation', async () => {
  let attempts = 0
  await assert.rejects(retryTransient(async () => {
    attempts += 1
    throw new Error('unauthorized')
  }, { attempts: 3, delayMs: 0 }), /unauthorized/)
  assert.equal(attempts, 1)
})
