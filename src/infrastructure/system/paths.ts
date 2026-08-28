import os from 'node:os'
import path from 'node:path'

export interface AppPaths {
  readonly root: string
  readonly configFile: string
  readonly stateFile: string
  readonly lockFile: string
  readonly cacheDir: string
  readonly logDir: string
  readonly logFile: string
  readonly launchAgentFile: string
  readonly installRoot: string
  readonly cliLink: string
}

export function resolvePaths(env: NodeJS.ProcessEnv = process.env): AppPaths {
  const userHome = env.HOME ?? os.homedir()
  const root = env.CONTRIB_CAL_SYNC_HOME ?? path.join(userHome, 'Library', 'Application Support', 'contrib-cal-sync')
  const logDir = env.CONTRIB_CAL_SYNC_LOG_DIR ?? path.join(userHome, 'Library', 'Logs', 'contrib-cal-sync')

  return {
    root,
    configFile: path.join(root, 'config.json'),
    stateFile: path.join(root, 'state.json'),
    lockFile: path.join(root, 'run.lock'),
    cacheDir: path.join(root, 'cache'),
    logDir,
    logFile: path.join(logDir, 'service.log'),
    launchAgentFile: path.join(userHome, 'Library', 'LaunchAgents', 'com.d3rise.contrib-cal-sync.plist'),
    installRoot: path.join(root, 'versions'),
    cliLink: path.join(userHome, '.local', 'bin', 'contrib-cal-sync')
  }
}
