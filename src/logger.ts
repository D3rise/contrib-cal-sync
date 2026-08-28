import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface LoggerOptions {
  readonly maxBytes: number
  readonly files: number
  readonly secrets?: readonly string[]
}

export class RotatingLogger {
  constructor(private readonly file: string, private readonly options: LoggerOptions) {}

  private redact(value: string): string {
    let output = value.replace(/(authorization|private-token)(["']?\s*[:=]\s*["']?)([^\s,"'}]+)/gi, '$1$2[REDACTED]')
    output = output.replace(/Bearer\s+[^\s,"'}]+/gi, 'Bearer [REDACTED]')
    for (const secret of this.options.secrets ?? []) {
      if (secret !== '') output = output.split(secret).join('[REDACTED]')
    }
    return output
  }

  private async rotate(nextBytes: number): Promise<void> {
    let currentBytes = 0
    try { currentBytes = (await stat(this.file)).size } catch { /* first write */ }
    if (currentBytes + nextBytes <= this.options.maxBytes) return
    for (let index = this.options.files - 1; index >= 1; index -= 1) {
      try { await rename(index === 1 ? this.file : `${this.file}.${index - 1}`, `${this.file}.${index}`) } catch { /* absent generation */ }
    }
  }

  private async write(level: string, message: string, context?: unknown): Promise<void> {
    const serialized = this.redact(JSON.stringify(
      { time: new Date().toISOString(), level, message, ...(context === undefined ? {} : { context }) },
      (key, value: unknown) => /authorization|token|password|secret/i.test(key) ? '[REDACTED]' : value
    )) + '\n'
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 })
    await this.rotate(Buffer.byteLength(serialized))
    await writeFile(this.file, serialized, { flag: 'a', mode: 0o600 })
  }

  info(message: string, context?: unknown): Promise<void> { return this.write('info', message, context) }
  error(message: string, context?: unknown): Promise<void> { return this.write('error', message, context) }
}
