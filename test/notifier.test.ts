import assert from 'node:assert/strict'
import test from 'node:test'

import { MacNotifier } from '../src/notifier.js'

test('launches the native helper with a Retry action and no shell interpolation', async () => {
  const calls: Array<{ executable: string; args: readonly string[] }> = []
  const notifier = new MacNotifier('/Applications/ContributionNotifier.app', '/Users/alice/.local/bin/contrib-cal-sync', async (executable, args) => {
    calls.push({ executable, args })
  })
  await notifier.send('Source unavailable', true)
  assert.equal(calls[0]?.executable, '/usr/bin/open')
  assert.deepEqual(calls[0]?.args, [
    '-n', '-g', '/Applications/ContributionNotifier.app', '--args', 'notify',
    '--title', 'Contribution Calendar Mirror', '--body', 'Source unavailable',
    '--retry-command', '/Users/alice/.local/bin/contrib-cal-sync'
  ])
})

test('omits the retry command for recovery notifications', async () => {
  const calls: string[][] = []
  const notifier = new MacNotifier('/Applications/ContributionNotifier.app', '/cli', async (_executable, args) => { calls.push([...args]) })
  await notifier.send('Recovered', false)
  assert.ok(!calls[0]?.includes('--retry-command'))
})
