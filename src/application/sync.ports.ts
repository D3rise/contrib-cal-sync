import type { ContributionCalendar } from '../domain/contribution-calendar.js'
import type { AppConfig, CommitIdentity, MirrorPlanItem, RunState } from './sync.types.js'

export type CredentialKind = 'gitlab' | 'github'

export interface ConfigurationPort {
  load(): Promise<AppConfig>
  save(config: AppConfig): Promise<void>
  defaults(): AppConfig
}

export interface CredentialPort {
  get(kind: CredentialKind): Promise<string>
  set(kind: CredentialKind, secret: string): Promise<void>
  has(kind: CredentialKind): Promise<boolean>
}

export interface ContributionSourcePort {
  load(config: AppConfig, token: string): Promise<ContributionCalendar>
}

export interface DestinationIdentityPort {
  resolve(config: AppConfig, token: string): Promise<CommitIdentity>
}

export interface MirrorRepositoryPort {
  readMirroredCounts(): Promise<ContributionCalendar>
  createCommits(plan: readonly MirrorPlanItem[], identity: CommitIdentity, timeZone: string): Promise<number>
  push(): Promise<void>
  cleanup(): Promise<void>
}

export interface MirrorRepositoryFactoryPort {
  open(config: AppConfig, token: string): Promise<MirrorRepositoryPort>
}

export interface NotificationPort {
  send(message: string, retry: boolean): Promise<void>
}

export interface RunStatePort {
  read(): Promise<RunState>
  recordFailure(kind: 'network' | 'permanent', threshold: number, message?: string): Promise<{ readonly notify: boolean }>
  recordSuccess(commitCount?: number): Promise<{ readonly recovered: boolean }>
}

export interface RunLockPort {
  acquire(): Promise<boolean>
  release(): Promise<void>
}

export interface LogPort {
  info(message: string, context?: unknown): Promise<void>
  error(message: string, context?: unknown): Promise<void>
}

export interface ClockPort {
  today(timeZone: string): string
}
