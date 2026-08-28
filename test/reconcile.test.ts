import assert from 'node:assert/strict'
import test from 'node:test'

import { createMirrorPlan as planMirror } from '../src/domain/reconciliation.js'

const limits = { perDay: 1_000, perRun: 20_000 }

test('plans all eighty-four missing mirror commits', () => {
  assert.deepEqual(planMirror({ '2026-07-02': 84 }, {}, limits, '2026-08-28', 365), [{ date: '2026-07-02', count: 84 }])
})

test('adds only the append-only difference and never removes excess commits', () => {
  assert.deepEqual(
    planMirror({ '2026-08-27': 6, '2026-08-28': 1 }, { '2026-08-27': 2, '2026-08-28': 4 }, limits, '2026-08-28', 365),
    [{ date: '2026-08-27', count: 4 }]
  )
})

test('ignores source dates outside the configured lookback', () => {
  assert.deepEqual(planMirror({ '2025-01-01': 5, '2026-08-28': 1 }, {}, limits, '2026-08-28', 30), [{ date: '2026-08-28', count: 1 }])
})

test('stops when a daily count exceeds the configured guard', () => {
  assert.throws(() => planMirror({ '2026-08-28': 1_001 }, {}, limits, '2026-08-28', 365), /1,000.*day/i)
})

test('stops when a run exceeds the configured guard', () => {
  assert.throws(
    () => planMirror({ '2026-08-27': 600, '2026-08-28': 600 }, {}, { perDay: 1_000, perRun: 1_000 }, '2026-08-28', 365),
    /1,000.*run/i
  )
})
