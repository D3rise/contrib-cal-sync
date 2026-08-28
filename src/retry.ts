export interface RetryPolicy {
  readonly attempts: number
  readonly delayMs: number
  readonly isTransient: (error: unknown) => boolean
  readonly sleep?: (milliseconds: number) => Promise<void>
}

export async function withRetry<T>(operation: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  const sleep = policy.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
  for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === policy.attempts || !policy.isTransient(error)) throw error
      if (policy.delayMs > 0) await sleep(policy.delayMs)
    }
  }
  throw new Error('Retry policy exhausted unexpectedly.')
}
