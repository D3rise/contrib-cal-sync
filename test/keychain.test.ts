import assert from 'node:assert/strict'
import test from 'node:test'

import { KeychainCredentialAdapter, secureCommandRunner, type SecureCommandRunner } from '../src/infrastructure/security/keychain-credential.adapter.js'

test('round-trips credentials through the real macOS Keychain without a terminal prompt', {
  skip: process.platform !== 'darwin' || process.env.CONTRIB_CAL_SYNC_TEST_KEYCHAIN !== '1'
}, async () => {
  const service = `com.d3rise.contrib-cal-sync.test.${process.pid}`
  const replaceService = (value: string): string => value.replaceAll('com.d3rise.contrib-cal-sync.github', service)
  const store = new KeychainCredentialAdapter((executable, args, input) =>
    secureCommandRunner(executable, args.map(replaceService), input === undefined ? undefined : replaceService(input)))
  try {
    for (const value of ['test-only-token_abcdefghijklmnopqrstuvwxyz_0123456789', 'space quote" slash\\ dollar$ single\'']) {
      await store.set('github', value)
      assert.equal(await store.get('github'), value)
    }
  } finally {
    await store.delete('github')
  }
})

test('writes a credential through stdin instead of process arguments', async () => {
  const calls: Array<{ args: readonly string[]; input?: string }> = []
  const runner: SecureCommandRunner = async (_executable, args, input) => {
    calls.push({ args, ...(input === undefined ? {} : { input }) })
    return args[0] === 'find-generic-password' ? 'top-secret\n' : ''
  }
  const store = new KeychainCredentialAdapter(runner)
  await store.set('gitlab', 'top-secret')

  assert.ok(calls[0]?.input?.includes('top-secret'))
  assert.ok(calls.every(call => !call.args.some(arg => arg.includes('top-secret'))))
})

test('rejects a successful write when Keychain still returns a different credential', async () => {
  const store = new KeychainCredentialAdapter(async () => 'old-value\n')
  await assert.rejects(store.set('github', 'new-value'), /Unable to save and verify/)
})

test('does not expose interpreter output on write failure', async () => {
  const store = new KeychainCredentialAdapter(async () => { throw new Error('command containing top-secret') })
  await assert.rejects(store.set('github', 'top-secret'), error =>
    error instanceof Error && !error.message.includes('top-secret') && error.cause === undefined)
})

test('rejects multi-line credentials before invoking the command interpreter', async () => {
  let called = false
  const store = new KeychainCredentialAdapter(async () => { called = true; return '' })
  await assert.rejects(store.set('github', 'first\nsecond'), /single line/)
  assert.equal(called, false)
})

test('reads and trims a credential from Keychain output', async () => {
  const store = new KeychainCredentialAdapter(async () => 'stored-secret\n')
  assert.equal(await store.get('github'), 'stored-secret')
})
