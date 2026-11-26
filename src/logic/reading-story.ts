import { readingEdition1 } from './reading-edition-v1'
import type { FocusRecord, SceneId } from './types'

export type ReadingVariant = 'hat' | 'chapter' | 'reread'
export type ReadingStage = 'open' | 'turn' | 'later' | 'linger' | 'found' | 'closed'
export type ReadingIllustration = 'reading' | 'dog-hat' | 'dog-found' | 'closed-book'
export interface ReadingBinding {
  version: 1
  variant: ReadingVariant
  bookmark: 'original' | 'next'
}

export interface ReadingMemory extends ReadingBinding {
  stage: ReadingStage
  archive: 'note' | 'page'
  title: string
  caption: string
  illustration: ReadingIllustration
  excerpt?: string
}

/** Only a completed first chapter moves this book's ticket. Read from the confirmed dataset. */
export function readingBookmarkSource<T extends Pick<FocusRecord, 'sessionId' | 'endedAt' | 'reading' | 'endReason'>>(records: readonly T[]): T | undefined {
  let first: T | undefined
  for (const record of records) {
    if (record.endReason !== 'deadline' || record.reading?.variant !== 'chapter' || record.reading.archive !== 'page') continue
    if (!first || record.endedAt < first.endedAt || (record.endedAt === first.endedAt && record.sessionId < first.sessionId)) first = record
  }
  return first
}

export function bindReading(sceneId: SceneId, minutes: number | undefined, durableRecords: readonly FocusRecord[]): ReadingBinding | undefined {
  if (sceneId !== 'F3' || (minutes !== readingEdition1.hat.minutes && minutes !== readingEdition1.chapter.minutes)) return
  const bookmark = readingBookmarkSource(durableRecords) ? 'next' : 'original'
  const variant = minutes === readingEdition1.hat.minutes ? 'hat' : bookmark === 'next' ? 'reread' : 'chapter'
  return { version: 1, variant, bookmark }
}

function reachedPassage(binding: ReadingBinding, progress: number, deadlineEnded: boolean) {
  const script = readingEdition1[binding.variant]
  if (deadlineEnded && progress >= 1) return script.ending
  let passage = script.beats[0]!
  for (const beat of script.beats) {
    if (progress < beat.at) break
    passage = beat
  }
  return passage
}

export function readingStage(binding: ReadingBinding, completedProgress: number, deadlineEnded = false): ReadingStage {
  return reachedPassage(binding, completedProgress, deadlineEnded).stage
}

export function archiveReading(binding: ReadingBinding, elapsedMs: number, endReason: FocusRecord['endReason']): ReadingMemory {
  const script = readingEdition1[binding.variant]
  const progress = elapsedMs / (script.minutes * 60_000)
  const page = endReason === 'deadline' && progress >= 1
  const { stage, illustration, caption, excerpt } = reachedPassage(binding, progress, page)
  return { ...binding, stage, illustration, caption, title: script.title, archive: page ? 'page' : 'note',
    ...(excerpt ? { excerpt } : {}) }
}

/** A local story result only counts as saved when the same snapshot reached disk. */
export function sameReadingMemory(a?: ReadingMemory, b?: ReadingMemory): boolean {
  return a === b || (!!a && !!b && a.version === b.version && a.variant === b.variant && a.bookmark === b.bookmark &&
    a.archive === b.archive && a.stage === b.stage && a.illustration === b.illustration &&
    a.title === b.title && a.caption === b.caption && a.excerpt === b.excerpt)
}
