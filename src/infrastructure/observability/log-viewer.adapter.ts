import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import type { LogViewerPort } from '../../application/operations.ports.js'

export class LogViewerAdapter implements LogViewerPort {
  constructor(private readonly file: string) {}
  async show(follow: boolean): Promise<void> {
    if (!follow) {
      try { process.stdout.write(await readFile(this.file, 'utf8')) } catch { process.stdout.write('No application logs yet.\n') }
      return
    }
    await new Promise<void>((resolve, reject) => {
      const child = spawn('/usr/bin/tail', ['-n', '100', '-f', this.file], { stdio: 'inherit' })
      child.on('error', reject)
      child.on('close', () => resolve())
    })
  }
}
