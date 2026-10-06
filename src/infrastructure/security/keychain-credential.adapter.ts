import { spawn } from 'node:child_process'
import type { CredentialKind, CredentialPort } from '../../application/sync.ports.js'

export type SecureCommandRunner = (executable: string, args: readonly string[], input?: string) => Promise<string>

const services: Record<CredentialKind, string> = {
  gitlab: 'com.d3rise.contrib-cal-sync.gitlab',
  github: 'com.d3rise.contrib-cal-sync.github'
}

export const secureCommandRunner: SecureCommandRunner = (executable, args, input) => new Promise((resolve, reject) => {
  const child = spawn(executable, [...args], { stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
  child.on('error', reject)
  child.on('close', code => {
    if (code === 0) resolve(stdout)
    else reject(new Error(`Keychain command failed with exit code ${code}: ${stderr.trim()}`))
  })
  child.stdin.end(input)
})

export class KeychainCredentialAdapter implements CredentialPort {
  constructor(private readonly runner: SecureCommandRunner = secureCommandRunner) {}

  async set(kind: CredentialKind, secret: string): Promise<void> {
    const value = secret.trim()
    if (value === '') throw new Error('Credential cannot be empty.')
    if (/[\r\n\0]/.test(value)) throw new Error('Credential must be a single line without null bytes.')
    // The -w prompt reads from the terminal, not the child's stdin. Instead,
    // send a quoted command to security's interpreter, keeping secrets out of argv.
    const quoted = `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
    try {
      await this.runner('/usr/bin/security', ['-i'], `add-generic-password -U -a default -s ${services[kind]} -w ${quoted}\n`)
      // Interactive security can exit successfully even when a command failed.
      if (await this.get(kind) !== value) throw new Error('Credential did not round-trip.')
    } catch {
      // Do not expose interpreter output: it may contain the submitted command.
      throw new Error(`Unable to save and verify ${kind} credential in macOS Keychain.`)
    }
  }

  async get(kind: CredentialKind): Promise<string> {
    const value = (await this.runner('/usr/bin/security', ['find-generic-password', '-a', 'default', '-s', services[kind], '-w'])).trim()
    if (value === '') throw new Error(`${kind} credential is empty in macOS Keychain.`)
    return value
  }

  async has(kind: CredentialKind): Promise<boolean> {
    try {
      await this.get(kind)
      return true
    } catch {
      return false
    }
  }

  async delete(kind: CredentialKind): Promise<void> {
    try {
      await this.runner('/usr/bin/security', ['delete-generic-password', '-a', 'default', '-s', services[kind]])
    } catch {
      // Purge is idempotent when an item is already absent.
    }
  }
}
