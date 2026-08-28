export type ContributionCalendar = Readonly<Record<string, number>>

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function parseContributionCalendar(value: unknown): ContributionCalendar {
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
