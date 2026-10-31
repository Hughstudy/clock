import { identitySeed } from './scenes'

export type RecordsBand = 'morning' | 'afternoon' | 'evening' | 'night'

/** Version 1. The order and hash are part of the illustration for every existing entry. */
const STORIES_V1 = ['leaf', 'map', 'star'] as const
export type RecordStoryId = typeof STORIES_V1[number]

export function recordStoryId(sessionId: string): RecordStoryId {
  return STORIES_V1[identitySeed(sessionId) % STORIES_V1.length]!
}

export function recordsBand(localHour: number): RecordsBand {
  if (localHour < 6 || localHour >= 21) return 'night'
  if (localHour < 12) return 'morning'
  if (localHour < 17) return 'afternoon'
  return 'evening'
}
