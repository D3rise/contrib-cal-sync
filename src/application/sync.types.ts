import type { MirrorLimits, MirrorPlanItem } from '../domain/reconciliation.js'

export interface AppConfig {
  readonly schemaVersion: 1
  readonly calendarUrl: string
  readonly mirrorRepositoryUrl: string
  readonly intervalMinutes: number
  readonly lookbackDays: number
  readonly timeZone: string
  readonly limits: MirrorLimits
  readonly notifications: {
    readonly enabled: boolean
    readonly networkFailureThreshold: number
  }
  readonly gitIdentity?: {
    readonly name?: string
    readonly email?: string
  }
}

export interface CommitIdentity {
  readonly name: string
  readonly email: string
}

export interface RunState {
  readonly consecutiveNetworkFailures: number
  readonly failureNotified: boolean
  readonly lastOutcome: 'never' | 'success' | 'failure'
  readonly lastRunAt?: string
  readonly lastError?: string
  readonly lastCommitCount?: number
}

export type SyncResult =
  | { readonly status: 'skipped'; readonly reason: 'locked' }
  | { readonly status: 'dry-run' | 'success'; readonly commits: number; readonly days: number }

export type { MirrorPlanItem }
