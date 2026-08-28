import type { ClockPort } from '../../application/sync.ports.js'

export function todayInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find(value => value.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export class SystemClockAdapter implements ClockPort {
  today(timeZone: string): string {
    return todayInTimeZone(new Date(), timeZone)
  }
}
