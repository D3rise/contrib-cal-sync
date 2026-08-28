import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { runCommand } from './process.js'

export interface LaunchAgentOptions {
  readonly nodePath: string
  readonly cliPath: string
  readonly intervalMinutes: number
  readonly stdoutPath: string
  readonly stderrPath: string
}

function xml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

export function createLaunchAgentPlist(options: LaunchAgentOptions): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.d3rise.contrib-cal-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(options.nodePath)}</string>
    <string>${xml(options.cliPath)}</string>
    <string>run</string>
    <string>--scheduled</string>
  </array>
  <key>StartInterval</key>
  <integer>${options.intervalMinutes * 60}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${xml(options.stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(options.stderrPath)}</string>
</dict>
</plist>
`
}

export class LaunchdManager {
  constructor(private readonly plistFile: string, private readonly options: LaunchAgentOptions) {}

  private domain(): string {
    const uid = process.getuid?.()
    if (uid === undefined) throw new Error('launchd service management requires macOS.')
    return `gui/${uid}`
  }

  async enable(): Promise<void> {
    await mkdir(path.dirname(this.plistFile), { recursive: true })
    await mkdir(path.dirname(this.options.stdoutPath), { recursive: true })
    await writeFile(this.plistFile, createLaunchAgentPlist(this.options), { mode: 0o600 })
    try { await runCommand('/bin/launchctl', ['bootout', this.domain(), this.plistFile]) } catch { /* not loaded */ }
    await runCommand('/bin/launchctl', ['bootstrap', this.domain(), this.plistFile])
  }

  async disable(): Promise<void> {
    try { await runCommand('/bin/launchctl', ['bootout', this.domain(), this.plistFile]) } catch { /* idempotent */ }
  }

  async restart(): Promise<void> {
    await this.enable()
  }
}
