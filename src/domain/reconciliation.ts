import type { ContributionCalendar } from './contribution-calendar.js'

export interface MirrorPlanItem {
  readonly date: string
  readonly count: number
}

export interface MirrorLimits {
  readonly perDay: number
  readonly perRun: number
}

function lookbackStart(today: string, lookbackDays: number): string {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - lookbackDays + 1)
  return date.toISOString().slice(0, 10)
}

export function createMirrorPlan(
  source: ContributionCalendar,
  mirrored: ContributionCalendar,
  limits: MirrorLimits,
  today: string,
  lookbackDays: number
): readonly MirrorPlanItem[] {
  const start = lookbackStart(today, lookbackDays)
  const plan: MirrorPlanItem[] = []
  let total = 0

  for (const date of Object.keys(source).sort()) {
    if (date < start || date > today) continue
    const missing = Math.max(0, (source[date] ?? 0) - (mirrored[date] ?? 0))
    if (missing === 0) continue
    if (missing > limits.perDay) {
      throw new Error(`Mirror plan exceeds the ${limits.perDay.toLocaleString('en-US')} commits per day safety limit for ${date}.`)
    }
    total += missing
    if (total > limits.perRun) {
      throw new Error(`Mirror plan exceeds the ${limits.perRun.toLocaleString('en-US')} commits per run safety limit.`)
    }
    plan.push({ date, count: missing })
  }
  return plan
}
