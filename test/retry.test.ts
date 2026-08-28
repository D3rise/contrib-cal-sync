import assert from 'node:assert/strict'
import test from 'node:test'

import { withRetry } from '../src/retry.js'

test('retries a transient operation twice before succeeding', async () => {
  let attempts = 0
  const result = await withRetry(async () => {
    attempts += 1
    if (attempts < 3) throw Object.assign(new Error('offline'), { transient: true })
    return 'ok'
  }, { attempts: 3, delayMs: 0, isTransient: error => (error as { transient?: boolean }).transient === true })
  assert.equal(result, 'ok')
  assert.equal(attempts, 3)
})

test('does not retry a permanent operation', async () => {
  let attempts = 0
  await assert.rejects(withRetry(async () => {
    attempts += 1
    throw new Error('unauthorized')
  }, { attempts: 3, delayMs: 0, isTransient: () => false }), /unauthorized/)
  assert.equal(attempts, 1)
})
