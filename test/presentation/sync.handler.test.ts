import assert from 'node:assert/strict'
import test from 'node:test'
import type { ContributionSyncService } from '../../src/application/contribution-sync.service.js'
import { SyncCommandHandler } from '../../src/presentation/cli/handlers/sync.handler.js'

test('delegates dry-run execution to the sync service', async () => {
  const calls: Array<{ dryRun?: boolean }> = []
  const output: string[] = []
  const sync = { execute: async (options: { dryRun?: boolean }) => { calls.push(options); return { status: 'dry-run' as const, commits: 2, days: 1 } } } as ContributionSyncService
  const handler = new SyncCommandHandler(sync, { write: value => { output.push(value) }, question: async () => '', secret: async () => '' })
  await handler.execute(['run', '--dry-run'])
  assert.deepEqual(calls, [{ dryRun: true }])
  assert.deepEqual(output, ['Dry run: 2 commits across 1 day.'])
})
