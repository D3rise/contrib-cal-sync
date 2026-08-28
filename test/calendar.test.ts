import assert from 'node:assert/strict'
import test from 'node:test'

import { CalendarFetchError, fetchCalendar, parseCalendarJson } from '../src/calendar.js'

test('parses a calendar date-to-count object', () => {
  assert.deepEqual(parseCalendarJson({ '2026-06-03': 2, '2026-07-02': 84, '2026-08-28': 1 }), {
    '2026-06-03': 2,
    '2026-07-02': 84,
    '2026-08-28': 1
  })
})

for (const invalid of [
  { '2026-02-30': 1 },
  { '28-08-2026': 1 },
  { '2026-08-28': -1 },
  { '2026-08-28': 1.5 },
  []
]) {
  test(`rejects malformed calendar value ${JSON.stringify(invalid)}`, () => {
    assert.throws(() => parseCalendarJson(invalid), /calendar/i)
  })
}

test('fetches the configured calendar with a private token header', async () => {
  const response = await fetchCalendar(
    'https://gitlab.example.com/users/alice/calendar.json',
    'secret-value',
    async (input, init) => {
      assert.equal(input, 'https://gitlab.example.com/users/alice/calendar.json')
      assert.equal(new Headers(init?.headers).get('private-token'), 'secret-value')
      return new Response('{"2026-08-28":1}', { status: 200, headers: { 'content-type': 'application/json' } })
    }
  )
  assert.deepEqual(response, { '2026-08-28': 1 })
})

test('classifies an unavailable source as transient without exposing the URL', async () => {
  await assert.rejects(
    fetchCalendar('https://gitlab.example.com/users/alice/calendar.json', 'secret-value', async () => {
      throw new TypeError('fetch failed')
    }),
    (error: unknown) => error instanceof CalendarFetchError && error.transient && !error.message.includes('gitlab.example.com')
  )
})

test('classifies authentication failure as permanent', async () => {
  await assert.rejects(
    fetchCalendar('https://gitlab.example.com/users/alice/calendar.json', 'secret-value', async () => new Response('', { status: 401 })),
    (error: unknown) => error instanceof CalendarFetchError && !error.transient
  )
})
