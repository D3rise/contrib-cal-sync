import assert from 'node:assert/strict'
import test from 'node:test'

import { runCli, type CliDependencies } from '../src/cli.js'
import { defaultConfig } from '../src/config.js'

function dependencies(): { deps: CliDependencies; output: string[] } {
  const output: string[] = []
  return {
    output,
    deps: {
      loadConfig: async () => ({
        ...defaultConfig(),
        calendarUrl: 'https://gitlab.example.com/users/alice/calendar.json',
        mirrorRepositoryUrl: 'https://github.com/alice/mirror.git',
        timeZone: 'Europe/Moscow'
      }),
      configure: async () => undefined,
      saveConfig: async () => undefined,
      credentialStatus: async () => ({ gitlab: true, github: false }),
      setCredential: async () => undefined,
      promptSecret: async () => 'secret',
      runSync: async dryRun => ({ status: dryRun ? 'dry-run' : 'success', commits: 2, days: 1 }),
      readStatus: async () => ({ lastOutcome: 'success' }),
      service: async () => undefined,
      doctor: async () => ['Configuration: OK', 'GitHub credential: missing'],
      logs: async () => undefined,
      write: value => { output.push(value) }
    }
  }
}

test('shows configuration and only credential presence', async () => {
  const { deps, output } = dependencies()
  assert.equal(await runCli(['config', 'show'], deps), 0)
  const text = output.join('\n')
  assert.match(text, /"gitlab": "configured"/)
  assert.match(text, /"github": "missing"/)
  assert.doesNotMatch(text, /secret-value|top-secret/)
})

test('runs a dry-run through the public command', async () => {
  const { deps, output } = dependencies()
  assert.equal(await runCli(['run', '--dry-run'], deps), 0)
  assert.match(output.join('\n'), /2 commits across 1 day/)
})

test('runs the interactive configuration command', async () => {
  const { deps, output } = dependencies()
  let configured = false
  deps.configure = async () => { configured = true }
  assert.equal(await runCli(['configure'], deps), 0)
  assert.equal(configured, true)
  assert.match(output.join('\n'), /Configuration completed/)
})

test('returns usage failure for an unknown command', async () => {
  const { deps, output } = dependencies()
  assert.equal(await runCli(['unknown'], deps), 2)
  assert.match(output.join('\n'), /Usage:/)
})
