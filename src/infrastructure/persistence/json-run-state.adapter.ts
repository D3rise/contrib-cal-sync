import { mkdir, open, readFile, rename, unlink, writeFile, type FileHandle } from 'node:fs/promises'
import path from 'node:path'
import type { RunLockPort, RunStatePort } from '../../application/sync.ports.js'
import type { RunState } from '../../application/sync.types.js'

const initialState: RunState = { consecutiveNetworkFailures: 0, failureNotified: false, lastOutcome: 'never' }

export class JsonRunStateAdapter implements RunStatePort {
  constructor(private readonly file: string) {}

  async read(): Promise<RunState> {
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as RunState
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return initialState
      throw error
    }
  }

  private async write(state: RunState): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 })
    const temporary = `${this.file}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, this.file)
  }

  async recordFailure(kind: 'network' | 'permanent', threshold: number, message = 'Sync failed.'): Promise<{ notify: boolean; state: RunState }> {
    const previous = await this.read()
    const consecutiveNetworkFailures = kind === 'network' ? previous.consecutiveNetworkFailures + 1 : 0
    const reachedThreshold = kind === 'network' ? consecutiveNetworkFailures >= threshold : true
    const notify = reachedThreshold && !previous.failureNotified
    const state: RunState = {
      consecutiveNetworkFailures,
      failureNotified: previous.failureNotified || notify,
      lastOutcome: 'failure',
      lastRunAt: new Date().toISOString(),
      lastError: message
    }
    await this.write(state)
    return { notify, state }
  }

  async recordSuccess(commitCount = 0): Promise<{ recovered: boolean; state: RunState }> {
    const previous = await this.read()
    const state: RunState = {
      consecutiveNetworkFailures: 0,
      failureNotified: false,
      lastOutcome: 'success',
      lastRunAt: new Date().toISOString(),
      lastCommitCount: commitCount
    }
    await this.write(state)
    return { recovered: previous.failureNotified, state }
  }
}

export class FileRunLockAdapter implements RunLockPort {
  private handle: FileHandle | undefined
  constructor(private readonly file: string) {}

  async acquire(): Promise<boolean> {
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 })
    try {
      this.handle = await open(this.file, 'wx', 0o600)
      await this.handle.writeFile(`${process.pid}\n`)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false
      throw error
    }
  }

  async release(): Promise<void> {
    await this.handle?.close()
    this.handle = undefined
    try {
      await unlink(this.file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}
