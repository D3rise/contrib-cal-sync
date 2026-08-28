import assert from 'node:assert/strict'
import test from 'node:test'
import { CliController } from '../../src/presentation/cli/cli.controller.js'
import type { CliIo, CommandHandler } from '../../src/presentation/cli/command-handler.js'

function io(output: string[]): CliIo {
  return { write: value => { output.push(value) }, question: async () => '', secret: async () => '' }
}

test('routes one command to the matching handler', async () => {
  const output: string[] = []
  let executions = 0
  const handler: CommandHandler = { matches: args => args[0] === 'run', execute: async () => { executions += 1 } }
  const controller = new CliController([handler], io(output))
  assert.equal(await controller.execute(['run']), 0)
  assert.equal(executions, 1)
  assert.deepEqual(output, [])
})

test('prints usage for an unknown command', async () => {
  const output: string[] = []
  const controller = new CliController([], io(output))
  assert.equal(await controller.execute(['unknown']), 2)
  assert.match(output.join('\n'), /Usage:/)
})

test('translates handler errors into a stable exit code', async () => {
  const output: string[] = []
  const handler: CommandHandler = { matches: () => true, execute: async () => { throw new Error('broken') } }
  const controller = new CliController([handler], io(output))
  assert.equal(await controller.execute(['run']), 1)
  assert.deepEqual(output, ['Error: broken'])
})
