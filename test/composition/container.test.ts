import 'reflect-metadata'
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { ContributionSyncService } from '../../src/application/contribution-sync.service.js'
import { createContainer } from '../../src/composition/container.js'
import { TYPES } from '../../src/composition/tokens.js'
import type { RunStatePort } from '../../src/application/sync.ports.js'
import type { AppPaths } from '../../src/infrastructure/system/paths.js'
import { CliController } from '../../src/presentation/cli/cli.controller.js'

function paths(root: string): AppPaths {
  return {
    root,
    configFile: path.join(root, 'config.json'), stateFile: path.join(root, 'state.json'), lockFile: path.join(root, 'run.lock'),
    cacheDir: path.join(root, 'cache'), logDir: path.join(root, 'logs'), logFile: path.join(root, 'logs', 'service.log'),
    launchAgentFile: path.join(root, 'agent.plist'), installRoot: path.join(root, 'versions'), cliLink: path.join(root, 'bin', 'contrib-cal-sync')
  }
}

test('composition root resolves the executable graph and singleton stateful services', () => {
  const container = createContainer({ paths: paths('/tmp/contrib-cal-sync-container-test'), artifacts: { mainPath: '/app/main.js', helperPath: '/app/helper.app' } })
  assert.ok(container.get(CliController) instanceof CliController)
  assert.ok(container.get(ContributionSyncService) instanceof ContributionSyncService)
  assert.equal(container.get<RunStatePort>(TYPES.state), container.get<RunStatePort>(TYPES.state))
})
