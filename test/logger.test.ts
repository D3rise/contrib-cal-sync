import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { RotatingLogAdapter } from '../src/infrastructure/observability/rotating-log.adapter.js'

test('redacts registered secrets and authorization values', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'contrib-cal-log-'))
  const file = path.join(root, 'service.log')
  const logger = new RotatingLogAdapter(file, { maxBytes: 1_024, files: 2, secrets: ['top-secret'] })
  await logger.error('request failed', { token: 'top-secret', authorization: 'Bearer abc123', status: 401 })
  const output = await readFile(file, 'utf8')
  assert.doesNotMatch(output, /top-secret|abc123/)
  assert.match(output, /\[REDACTED\]/)
  assert.match(output, /401/)
})
