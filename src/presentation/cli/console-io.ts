import { createInterface } from 'node:readline/promises'
import type { CliIo } from './command-handler.js'

export class ConsoleIo implements CliIo {
  write(value: string): void { process.stdout.write(`${value}\n`) }

  async question(label: string, fallback?: string): Promise<string> {
    const reader = createInterface({ input: process.stdin, output: process.stdout })
    const prompt = fallback === undefined ? label : `${label} [${fallback}]: `
    const answer = (await reader.question(prompt)).trim()
    reader.close()
    return answer === '' && fallback !== undefined ? fallback : answer
  }

  async secret(label: string): Promise<string> {
    if (!process.stdin.isTTY || !process.stdout.isTTY || process.stdin.setRawMode === undefined) {
      return this.question(label)
    }
    process.stdout.write(label)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    return new Promise<string>((resolve, reject) => {
      let value = ''
      const cleanup = (): void => {
        process.stdin.off('data', onData)
        process.stdin.setRawMode?.(false)
        process.stdin.pause()
      }
      const onData = (chunk: Buffer): void => {
        for (const byte of chunk) {
          if (byte === 3) { cleanup(); reject(new Error('Input cancelled.')); return }
          if (byte === 10 || byte === 13) { cleanup(); process.stdout.write('\n'); resolve(value.trim()); return }
          if (byte === 127 || byte === 8) value = value.slice(0, -1)
          else value += String.fromCharCode(byte)
        }
      }
      process.stdin.on('data', onData)
    })
  }
}
