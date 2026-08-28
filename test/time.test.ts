import assert from 'node:assert/strict'
import test from 'node:test'

import { contributionTimestamp } from '../src/time.js'

test('timestamps a contribution at noon with the Moscow offset', () => {
  assert.equal(contributionTimestamp('2026-08-28', 'Europe/Moscow'), '2026-08-28T12:00:00+03:00')
})

test('uses the daylight-saving offset for the configured date', () => {
  assert.equal(contributionTimestamp('2026-01-15', 'America/New_York'), '2026-01-15T12:00:00-05:00')
  assert.equal(contributionTimestamp('2026-07-15', 'America/New_York'), '2026-07-15T12:00:00-04:00')
})
