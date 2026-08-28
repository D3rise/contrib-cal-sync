import assert from 'node:assert/strict'
import test from 'node:test'

import { createLaunchAgentPlist } from '../src/launchd.js'

test('creates an hourly per-user launch agent with absolute program paths', () => {
  const plist = createLaunchAgentPlist({
    nodePath: '/opt/homebrew/bin/node',
    cliPath: '/Users/alice/.local/lib/contrib-cal-sync/cli.js',
    intervalMinutes: 60,
    stdoutPath: '/Users/alice/Library/Logs/contrib-cal-sync/stdout.log',
    stderrPath: '/Users/alice/Library/Logs/contrib-cal-sync/stderr.log'
  })
  assert.match(plist, /<integer>3600<\/integer>/)
  assert.match(plist, /<string>\/opt\/homebrew\/bin\/node<\/string>/)
  assert.match(plist, /<string>run<\/string>/)
  assert.match(plist, /<string>--scheduled<\/string>/)
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/)
})

test('escapes XML-sensitive paths', () => {
  const plist = createLaunchAgentPlist({
    nodePath: '/path/a&b/node', cliPath: '/path/cli.js', intervalMinutes: 15,
    stdoutPath: '/tmp/out.log', stderrPath: '/tmp/error.log'
  })
  assert.match(plist, /a&amp;b/)
})
