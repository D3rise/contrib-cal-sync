export class SourceUnavailableError extends Error {
  readonly transient = true

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SourceUnavailableError'
  }
}

export class SourceResponseError extends Error {
  readonly transient = false

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SourceResponseError'
  }
}
