export type ContributionCalendar = Readonly<Record<string, number>>

export class CalendarFetchError extends Error {
  constructor(message: string, readonly transient: boolean, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CalendarFetchError'
  }
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function parseCalendarJson(value: unknown): ContributionCalendar {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('calendar response must be a date-to-count object')
  }

  const result: Record<string, number> = {}
  for (const [date, count] of Object.entries(value)) {
    if (!validIsoDate(date)) throw new Error(`calendar contains an invalid date: ${date}`)
    if (!Number.isInteger(count) || (count as number) < 0) {
      throw new Error(`calendar count for ${date} must be a non-negative integer`)
    }
    result[date] = count as number
  }
  return result
}

export async function fetchCalendar(
  calendarUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<ContributionCalendar> {
  let response: Response
  try {
    response = await fetchImpl(calendarUrl, {
      headers: { accept: 'application/json', 'private-token': token },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000)
    })
  } catch (cause) {
    throw new CalendarFetchError('The contribution source is unavailable. Connect to the required network and retry.', true, { cause })
  }

  if (!response.ok) {
    const transient = response.status === 408 || response.status === 429 || response.status >= 500
    throw new CalendarFetchError(
      transient ? `The contribution source returned a temporary HTTP ${response.status} error.` : `The contribution source rejected the request with HTTP ${response.status}.`,
      transient
    )
  }

  try {
    return parseCalendarJson(await response.json() as unknown)
  } catch (cause) {
    throw new CalendarFetchError('The contribution source returned an incompatible calendar response.', false, { cause })
  }
}
