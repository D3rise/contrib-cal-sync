import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveNoreplyEmail, getGitHubIdentity, parseGitHubRepositoryUrl } from '../src/infrastructure/github/github-api.client.js'

test('parses only a standalone github.com repository URL', () => {
  assert.deepEqual(parseGitHubRepositoryUrl('https://github.com/Octo-Cat/mirror.git'), {
    owner: 'Octo-Cat',
    repository: 'mirror'
  })
  assert.throws(() => parseGitHubRepositoryUrl('https://github.example.com/user/repo.git'), /GitHub/)
  assert.throws(() => parseGitHubRepositoryUrl('https://github.com/user/repo/extra'), /GitHub/)
})

test('loads the authenticated identity without exposing its token', async () => {
  const identity = await getGitHubIdentity('top-secret', async (_input, init) => {
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer top-secret')
    return new Response(JSON.stringify({ id: 42, login: 'octocat', name: 'The Octocat' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  })
  assert.deepEqual(identity, { id: 42, login: 'octocat', name: 'The Octocat' })
  assert.equal(deriveNoreplyEmail(identity), '42+octocat@users.noreply.github.com')
})

test('rejects an invalid GitHub token without echoing it', async () => {
  await assert.rejects(
    getGitHubIdentity('top-secret', async () => new Response('', { status: 401 })),
    (error: unknown) => error instanceof Error && /401/.test(error.message) && !error.message.includes('top-secret')
  )
})
