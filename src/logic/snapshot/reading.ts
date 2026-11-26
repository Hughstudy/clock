import { readingEdition1 } from '../reading-edition-v1'
import { archiveReading, type ReadingBinding, type ReadingMemory } from '../reading-story'
import type { FocusRecord, SceneAssignment } from '../types'
import { isRecord, isText } from './guards'

export function readReadingBinding(raw: unknown, scene: SceneAssignment | undefined, originalMs: number): ReadingBinding | undefined {
  if (scene?.sceneId !== 'F3' || !isRecord(raw) || raw.version !== 1) return
  const { variant, bookmark } = raw
  if (variant !== 'hat' && variant !== 'chapter' && variant !== 'reread') return
  if (bookmark !== 'next' && bookmark !== 'original') return
  if (variant === 'chapter' && bookmark !== 'original' || variant === 'reread' && bookmark !== 'next') return
  if (originalMs !== readingEdition1[variant].minutes * 60_000) return
  return { version: 1, variant, bookmark }
}

export function readReadingMemory(raw: unknown, record: FocusRecord): ReadingMemory | undefined {
  if (record.source !== 'native' || record.startedAt === null || !isRecord(raw)) return
  const binding = readReadingBinding(raw, record.scene, record.initialDurationMs ?? record.targetMs)
  if (!binding) return
  const expected = archiveReading(binding, record.elapsedMs, record.endReason)
  // Keep the printed words in this historical edition. A clock or scene alone cannot create a story.
  if (raw.stage !== expected.stage || raw.archive !== expected.archive || raw.illustration !== expected.illustration ||
      !isText(raw.title, 120) || !raw.title.trim() || !isText(raw.caption, 800) || !raw.caption.trim()) return
  if (expected.excerpt === undefined ? raw.excerpt !== undefined : !isText(raw.excerpt, 800) || !raw.excerpt.trim()) return
  return { ...binding, stage: expected.stage, archive: expected.archive, illustration: expected.illustration,
    title: raw.title, caption: raw.caption, ...(typeof raw.excerpt === 'string' ? { excerpt: raw.excerpt } : {}) }
}
