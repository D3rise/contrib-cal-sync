export function contributionTimestamp(date: string, timeZone: string): string {
  const instant = new Date(`${date}T12:00:00Z`)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  })
  const zoneName = formatter.formatToParts(instant).find(({ type }) => type === 'timeZoneName')?.value
  if (zoneName === undefined) throw new Error(`Unable to resolve time zone offset for ${timeZone}`)
  const offset = zoneName === 'GMT' ? '+00:00' : zoneName.replace(/^GMT/, '')
  if (!/^[+-]\d{2}:\d{2}$/.test(offset)) throw new Error(`Unsupported time zone offset: ${zoneName}`)
  return `${date}T12:00:00${offset}`
}
