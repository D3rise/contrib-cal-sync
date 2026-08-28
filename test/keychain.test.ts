import assert from 'node:assert/strict'
import test from 'node:test'

import { CredentialStore, type SecureCommandRunner } from '../src/keychain.js'

test('writes a credential through stdin instead of process arguments', async () => {
  const calls: Array<{ args: readonly string[]; input?: string }> = []
  const runner: SecureCommandRunner = async (_executable, args, input) => {
    calls.push({ args, ...(input === undefined ? {} : { input }) })
    return ''
  }
  const store = new CredentialStore(runner)
  await store.set('gitlab', 'top-secret')

  assert.equal(calls[0]?.input, 'top-secret\n')
  assert.equal(calls[0]?.args.at(-1), '-w')
  assert.ok(!calls[0]?.args.includes('top-secret'))
})

test('reads and trims a credential from Keychain output', async () => {
  const store = new CredentialStore(async () => 'stored-secret\n')
  assert.equal(await store.get('github'), 'stored-secret')
})
