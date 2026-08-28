export type ServiceAction = 'enable' | 'disable' | 'restart'

export interface SchedulerPort {
  execute(action: ServiceAction): Promise<void>
}

export interface DiagnosticsPort {
  run(): Promise<readonly string[]>
}

export interface LogViewerPort {
  show(follow: boolean): Promise<void>
}
