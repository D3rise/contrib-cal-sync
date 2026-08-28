import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

export interface CommandResult {
  readonly stdout: string
  readonly stderr: string
}

export async function runCommand(
  executable: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> {
  const result = await exec(executable, [...args], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    env: options.env ?? process.env,
    maxBuffer: 16 * 1024 * 1024
  })
  return { stdout: result.stdout, stderr: result.stderr }
}
