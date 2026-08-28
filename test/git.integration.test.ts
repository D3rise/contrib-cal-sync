import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

import { GitMirror } from '../src/git.js'

const exec = promisify(execFile)

async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await exec('git', args, { cwd })).stdout.trim()
}

async function fixtureWithOrdinaryCommit(): Promise<{ root: string; remote: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'contrib-cal-git-'))
  const remote = path.join(root, 'remote.git')
  const seed = path.join(root, 'seed')
  await git(root, 'init', '--bare', '--initial-branch=main', remote)
  await mkdir(seed)
  await git(seed, 'init', '--initial-branch=main')
  await git(seed, 'config', 'user.name', 'Fixture')
  await git(seed, 'config', 'user.email', 'fixture@example.com')
  await writeFile(path.join(seed, 'README.md'), 'ordinary history\n')
  await git(seed, 'add', 'README.md')
  await git(seed, '-c', 'commit.gpgsign=false', 'commit', '-m', 'ordinary commit')
  await git(seed, 'remote', 'add', 'origin', remote)
  await git(seed, 'push', '-u', 'origin', 'main')
  return { root, remote }
}

test('counts only marked mirror commits and preserves ordinary history', async () => {
  const { root, remote } = await fixtureWithOrdinaryCommit()
  const mirror = await GitMirror.clone({ repositoryUrl: remote, workDir: path.join(root, 'work'), defaultBranch: 'main' })

  await mirror.createCommits(
    [{ date: '2026-08-28', count: 2 }],
    { name: 'Octocat', email: '42+octocat@users.noreply.github.com' },
    'Europe/Moscow'
  )
  await mirror.push()

  assert.deepEqual(await mirror.readMirroredCounts(), { '2026-08-28': 2 })
  assert.match(await git(mirror.workDir, 'log', '--format=%s'), /ordinary commit/)
  assert.equal(await git(mirror.workDir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main')
})

test('initializes and pushes a completely empty repository', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'contrib-cal-empty-'))
  const remote = path.join(root, 'remote.git')
  await git(root, 'init', '--bare', '--initial-branch=main', remote)
  const mirror = await GitMirror.clone({ repositoryUrl: remote, workDir: path.join(root, 'work'), defaultBranch: 'main' })

  await mirror.initializeEmptyRepository()
  await mirror.push()

  assert.equal(await git(mirror.workDir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main')
  assert.deepEqual(await mirror.readMirroredCounts(), {})
  assert.match(await git(mirror.workDir, 'log', '-1', '--format=%s'), /initialize contribution mirror/i)
})
