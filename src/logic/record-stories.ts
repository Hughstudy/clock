export type RecordsBand = 'morning' | 'afternoon' | 'evening' | 'night'

export function recordsBand(localHour: number): RecordsBand {
  if (localHour < 6 || localHour >= 21) return 'night'
  if (localHour < 12) return 'morning'
  if (localHour < 17) return 'afternoon'
  return 'evening'
}
