import { SourceResponseError, SourceUnavailableError } from '../../application/errors.js'
import type { ContributionSourcePort } from '../../application/sync.ports.js'
import type { AppConfig } from '../../application/sync.types.js'
import { parseContributionCalendar, type ContributionCalendar } from '../../domain/contribution-calendar.js'

export async function fetchCalendar(
  calendarUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
  authentication: AppConfig['calendarAuth'] = 'pat'
): Promise<ContributionCalendar> {
  const headers = new Headers({ accept: 'application/json' })
  if (authentication === 'session') {
    if (!/^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+$/.test(token)) {
      throw new SourceResponseError('GitLab session must contain only the _gitlab_session cookie value.')
    }
    headers.set('cookie', `_gitlab_session=${token}`)
  } else {
    headers.set('private-token', token)
  }
  let response: Response
  try {
    response = await fetchImpl(calendarUrl, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000)
    })
  } catch (cause) {
    throw new SourceUnavailableError('The contribution source is unavailable. Connect to the required network and retry.', { cause })
  }

  if (!response.ok) {
    const transient = response.status === 408 || response.status === 429 || response.status >= 500
    const ErrorType = transient ? SourceUnavailableError : SourceResponseError
    throw new ErrorType(
      transient ? `The contribution source returned a temporary HTTP ${response.status} error.` : `The contribution source rejected the request with HTTP ${response.status}.`
    )
  }

  try {
    return parseContributionCalendar(await response.json() as unknown)
  } catch (cause) {
    throw new SourceResponseError('The contribution source returned an incompatible calendar response.', { cause })
  }
}

export class GitLabCalendarAdapter implements ContributionSourcePort {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  load(config: AppConfig, token: string): Promise<ContributionCalendar> {
    return fetchCalendar(config.calendarUrl, token, this.fetchImpl, config.calendarAuth)
  }
}
