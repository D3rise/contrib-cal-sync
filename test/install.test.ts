import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access, chmod, mkdtemp, mkdir, readFile, readlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

const exec = promisify(execFile)

async function exists(file: string): Promise<boolean> {
  try { await access(file); return true } catch { return false }
}

test('installs a staged version and user CLI without changing configuration', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'contrib-cal-install-'))
  const bin = path.join(home, 'fake-bin')
  await mkdir(bin)
  const node = path.join(bin, 'node')
  await writeFile(node, `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo v22.12.0
else
  exec "${process.execPath}" "$@"
fi
`)
  await chmod(node, 0o755)

  await exec('bash', ['scripts/install.sh', '--no-config'], {
    cwd: process.cwd(),
    env: { ...process.env, HOME: home, CONTRIB_CAL_SYNC_NODE: node, CONTRIB_CAL_SYNC_SKIP_BUILD: '1' }
  })

  const root = path.join(home, 'Library', 'Application Support', 'contrib-cal-sync')
  assert.match(await readlink(path.join(root, 'current')), /versions\/1\.0\.0-/)
  const cli = path.join(home, '.local', 'bin', 'contrib-cal-sync')
  assert.match(await readFile(cli, 'utf8'), /current\/dist\/main\.js/)
  const current = await readlink(path.join(root, 'current'))
  assert.equal(await exists(path.join(root, current, 'node_modules', 'inversify', 'package.json')), true)
  await assert.rejects(exec(cli, ['unknown']), (error: unknown) => {
    const failure = error as { code?: number; stdout?: string }
    return failure.code === 2 && failure.stdout?.includes('Usage:') === true
  })
  await assert.rejects(readFile(path.join(root, 'config.json'), 'utf8'), /ENOENT/)
})

test('rejects Node.js older than version 22 before changing the installation', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'contrib-cal-install-'))
  const node = path.join(home, 'node')
  await writeFile(node, '#!/bin/sh\necho v20.0.0\n')
  await chmod(node, 0o755)
  await assert.rejects(
    exec('bash', ['scripts/install.sh', '--no-config'], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home, CONTRIB_CAL_SYNC_NODE: node, CONTRIB_CAL_SYNC_SKIP_BUILD: '1' }
    }),
    /Node\.js 22/
  )
})

test('rejects macOS older than version 13 before changing the installation', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'contrib-cal-install-'))
  await assert.rejects(
    exec('bash', ['scripts/install.sh', '--no-config'], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home, CONTRIB_CAL_SYNC_MACOS_VERSION: '12.7.6' }
    }),
    /macOS 13/
  )
})

test('rolls back a fresh installation when configuration fails', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'contrib-cal-install-'))
  const node = path.join(home, 'node')
  await writeFile(node, '#!/bin/sh\nif [ "$1" = "--version" ]; then echo v22.12.0; else exit 42; fi\n')
  await chmod(node, 0o755)
  await assert.rejects(exec('bash', ['scripts/install.sh'], {
    cwd: process.cwd(),
    env: { ...process.env, HOME: home, CONTRIB_CAL_SYNC_NODE: node, CONTRIB_CAL_SYNC_SKIP_BUILD: '1' }
  }))
  const root = path.join(home, 'Library', 'Application Support', 'contrib-cal-sync')
  assert.equal(await exists(path.join(root, 'current')), false)
  assert.equal(await exists(path.join(root, 'versions')), true)
  assert.equal(await exists(path.join(home, '.local', 'bin', 'contrib-cal-sync')), false)
})
