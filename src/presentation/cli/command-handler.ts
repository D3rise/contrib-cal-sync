export interface CommandHandler {
  matches(args: readonly string[]): boolean
  execute(args: readonly string[]): Promise<void>
}

export interface CliIo {
  write(value: string): void
  question(label: string, fallback?: string): Promise<string>
  secret(label: string): Promise<string>
}
