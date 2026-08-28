export interface RetryPolicy {
  readonly attempts: number
  readonly delayMs: number
}

export async function retryTransient<T>(operation: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === policy.attempts || !(error instanceof Error && 'transient' in error && error.transient === true)) throw error
      if (policy.delayMs > 0) await new Promise(resolve => setTimeout(resolve, policy.delayMs))
    }
  }
  throw new Error('Retry policy exhausted unexpectedly.')
}
