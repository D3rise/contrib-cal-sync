import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

const exec = promisify(execFile)

async function exists(file: string): Promise<boolean> {
  try { await access(file); return true } catch { return false }
}

test('normal removal preserves configuration and logs while purge removes them', async () => {
  const actualHome = await mkdtemp(path.join(tmpdir(), 'contrib-cal-uninstall-'))
  const root = path.join(actualHome, 'Library', 'Application Support', 'contrib-cal-sync')
  const logs = path.join(actualHome, 'Library', 'Logs', 'contrib-cal-sync')
  const cli = path.join(actualHome, '.local', 'bin', 'contrib-cal-sync')
  const plist = path.join(actualHome, 'Library', 'LaunchAgents', 'com.d3rise.contrib-cal-sync.plist')
  await mkdir(path.join(root, 'versions', '1.0.0'), { recursive: true })
  await mkdir(logs, { recursive: true })
  await mkdir(path.dirname(cli), { recursive: true })
  await mkdir(path.dirname(plist), { recursive: true })
  await writeFile(path.join(root, 'config.json'), '{}')
  await writeFile(path.join(logs, 'service.log'), 'log')
  await writeFile(cli, 'wrapper')
  await writeFile(plist, 'plist')

  const env = { ...process.env, HOME: actualHome, CONTRIB_CAL_SYNC_LAUNCHCTL: '/usr/bin/true', CONTRIB_CAL_SYNC_SECURITY: '/usr/bin/true' }
  await exec('bash', ['scripts/uninstall.sh'], { cwd: process.cwd(), env })
  assert.equal(await exists(path.join(root, 'config.json')), true)
  assert.equal(await exists(path.join(logs, 'service.log')), true)
  assert.equal(await exists(cli), false)
  assert.equal(await exists(plist), false)
  assert.equal(await exists(path.join(root, 'versions')), false)

  await exec('bash', ['scripts/uninstall.sh', '--purge'], { cwd: process.cwd(), env })
  assert.equal(await exists(root), false)
  assert.equal(await exists(logs), false)
})
