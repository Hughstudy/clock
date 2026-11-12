import { isDateKey } from '../calendar'
import { isValidDuration } from '../settings'
import { initialScenes, isFocusSceneId, isSceneId } from '../scenes'
import type { Spec } from '../spec'
import { initialTimer } from '../timer'
import { quoteKey, type SavedQuote } from '../../contracts/favorites'
import { PHASES, type FocusRecord, type FocusSceneId, type ParticipationRecord, type Phase, type RestMemory, type SceneAssignment, type SceneRotation, type SceneState, type SceneUnlock, type Session, type Thought, type ThoughtDraft, type TimerState } from '../types'
import { isRecord, isCount, isEpochMs, isInstant, isPositiveMs, isId, isTimeZone, isText, isStep } from './guards'

function readSceneAssignment(raw: unknown): SceneAssignment | null {
  return isRecord(raw) && isSceneId(raw.sceneId) && isCount(raw.ordinal) && raw.ordinal > 0 && (raw.selectionVersion === 1 || raw.selectionVersion === 2)
    ? { sceneId: raw.sceneId, ordinal: raw.ordinal, selectionVersion: raw.selectionVersion } : null
}

function readSession(raw: unknown, issues: string[]): Session | null {
  if (!isRecord(raw) || !isId(raw.id) || !isPositiveMs(raw.durationMs) || !isTimeZone(raw.timeZone) || !(raw.startedAt === null || isInstant(raw.startedAt)) || !isStep(raw.step)) return null
  const { id, durationMs, timeZone, startedAt, step } = raw
  const scene = raw.scene === undefined ? null : readSceneAssignment(raw.scene)
  if (raw.scene !== undefined && !scene) issues.push('timer.session.scene')
  const art = scene ? { scene } : {}
  if (raw.status === 'running' && isInstant(raw.deadline)) return { status: 'running', id, durationMs, timeZone, startedAt, step, deadline: raw.deadline, ...art }
  if (raw.status === 'paused' && isInstant(raw.remainingMs) && raw.remainingMs <= durationMs) return { status: 'paused', id, durationMs, timeZone, startedAt, step, remainingMs: raw.remainingMs, ...art }
  return null
}

export function readTimer(raw: unknown, completionCount: number, issues: string[]): TimerState {
  if (!isRecord(raw)) { issues.push('timer'); return { ...initialTimer(), completedFocusCount: completionCount } }
  let phase: Phase = 'focus'
  if (PHASES.includes(raw.phase as Phase)) phase = raw.phase as Phase
  else issues.push('timer.phase')
  let session = raw.session === null ? null : readSession(raw.session, issues)
  if (session?.scene && isFocusSceneId(session.scene.sceneId) !== (phase === 'focus')) {
    issues.push('timer.session.scene.phase')
    const { scene: _scene, ...withoutScene } = session
    session = withoutScene
  }
  if (raw.session !== null && !session) issues.push('timer.session')
  let completedFocusCount = completionCount
  if (isCount(raw.completedFocusCount)) completedFocusCount = Math.max(raw.completedFocusCount, completionCount)
  else issues.push('timer.completedFocusCount')
  return { phase, session, completedFocusCount }
}

export function readRestSuggestion(raw: unknown, timer: TimerState, records: readonly FocusRecord[], issues: string[]): string | null {
  if (raw === null) return null
  if (isId(raw) && !timer.session && timer.phase !== 'focus' &&
      records.some(record => record.sessionId === raw && record.endReason === 'deadline')) return raw
  issues.push('restSuggestionSessionId')
  return null
}

export function readRecords(raw: unknown, issues: string[]): FocusRecord[] {
  if (!Array.isArray(raw)) { issues.push('records'); return [] }
  const seen = new Set<string>()
  const records: FocusRecord[] = []
  let dropped = 0
  for (const r of raw) {
    if (isRecord(r) && isId(r.sessionId) && isInstant(r.endedAt) && (r.startedAt === null || isInstant(r.startedAt)) &&
        isDateKey(r.dateKey) && isPositiveMs(r.targetMs) && isInstant(r.elapsedMs) && r.elapsedMs <= r.targetMs &&
        (r.endReason === 'manual' || (r.endReason === 'deadline' && r.elapsedMs === r.targetMs)) &&
        (r.source === 'native' || r.source === 'legacy') && isStep(r.step) && !seen.has(r.sessionId)) {
      seen.add(r.sessionId)
      const scene = r.scene === undefined ? null : readSceneAssignment(r.scene)
      if (r.scene !== undefined && (!scene || !isFocusSceneId(scene.sceneId))) issues.push(`record.scene (${r.sessionId})`)
      records.push({ sessionId: r.sessionId, startedAt: r.startedAt, endedAt: r.endedAt, dateKey: r.dateKey,
        targetMs: r.targetMs, elapsedMs: r.elapsedMs, endReason: r.endReason, source: r.source, step: r.step,
        ...(scene && isFocusSceneId(scene.sceneId) ? { scene } : {}) })
    } else dropped += 1
  }
  if (dropped) issues.push(`records (${dropped} unreadable)`)
  return records
}

export function readRestMemories(raw: unknown, issues: string[]): RestMemory[] {
  if (!Array.isArray(raw)) { issues.push('restMemories'); return [] }
  const memories: RestMemory[] = []
  const seen = new Set<string>()
  for (const rest of raw) {
    if (!isRecord(rest) || !isId(rest.sessionId) || seen.has(rest.sessionId) ||
        !isEpochMs(rest.endedAt) || !isCount(rest.elapsedMs) ||
        !(rest.dateKey === null || isDateKey(rest.dateKey)) ||
        !(rest.phase === null || rest.phase === 'shortBreak' || rest.phase === 'longBreak') ||
        !(rest.endReason === null || rest.endReason === 'manual' || (rest.endReason === 'deadline' && rest.elapsedMs > 0))) continue
    const sceneId = isSceneId(rest.sceneId) && !isFocusSceneId(rest.sceneId) ? rest.sceneId : null
    if (rest.sceneId !== sceneId) issues.push('restMemories.sceneId')
    const { sessionId, endedAt, elapsedMs, dateKey, phase, endReason } = rest
    memories.push({ sessionId, endedAt, elapsedMs, dateKey, phase, endReason, sceneId })
    seen.add(sessionId)
  }
  if (memories.length !== raw.length) issues.push(`restMemories (${raw.length - memories.length} unreadable)`)
  return memories
}

export function readParticipations(raw: unknown, issues: string[]): ParticipationRecord[] {
  if (!Array.isArray(raw)) { issues.push('participations'); return [] }
  const seen = new Set<string>()
  const result: ParticipationRecord[] = []
  let dropped = 0
  for (const p of raw) {
    if (isRecord(p) && isId(p.sessionId) && (p.participatedAt === null || isInstant(p.participatedAt)) &&
        (p.dateKey === null || isDateKey(p.dateKey)) &&
        (p.source === 'native' || p.source === 'legacy-completion' || p.source === 'legacy-active') && !seen.has(p.sessionId)) {
      seen.add(p.sessionId)
      result.push({ sessionId: p.sessionId, participatedAt: p.participatedAt, dateKey: p.dateKey, source: p.source })
    } else dropped += 1
  }
  if (dropped) issues.push(`participations (${dropped} unreadable)`)
  return result
}

export function readThoughts(raw: unknown, spec: Spec, issues: string[]): Thought[] {
  if (!Array.isArray(raw)) { issues.push('thoughts'); return [] }
  const seen = new Set<string>()
  const result: Thought[] = []
  let dropped = 0
  for (const t of raw) {
    if (isRecord(t) && isId(t.id) && isInstant(t.createdAt) && isDateKey(t.dateKey) && (t.sessionId === null || isId(t.sessionId)) &&
        isText(t.text, spec.thoughts.maxLength) && (t.status === 'open' || t.status === 'putAway') && isCount(t.rev) && t.rev > 0 &&
        (t.deletedAt === null || isInstant(t.deletedAt)) && !seen.has(t.id)) {
      seen.add(t.id)
      result.push({ id: t.id, createdAt: t.createdAt, dateKey: t.dateKey, sessionId: t.sessionId, text: t.text, status: t.status, rev: t.rev, deletedAt: t.deletedAt })
    } else dropped += 1
  }
  if (dropped) issues.push(`thoughts (${dropped} unreadable)`)
  return result
}

export function readDraft(raw: unknown, issues: string[]): ThoughtDraft | null {
  if (raw === null) return null
  if (isRecord(raw) && isId(raw.id) && (raw.thoughtId === null || isId(raw.thoughtId)) && typeof raw.text === 'string' &&
      (raw.baseRev === null || isCount(raw.baseRev)) && (raw.sessionId === null || isId(raw.sessionId)) &&
      isTimeZone(raw.timeZone) && (raw.createdAt === null || isInstant(raw.createdAt)) &&
      (raw.dateKey === null || isDateKey(raw.dateKey)) && (raw.createdAt === null) === (raw.dateKey === null)) {
    const { id, thoughtId, text, baseRev, sessionId, timeZone, createdAt, dateKey } = raw
    return { id, thoughtId, text, baseRev, sessionId, timeZone, createdAt, dateKey }
  }
  issues.push('thoughtDraft')
  return null
}

export function readFavorites(raw: unknown, issues: string[]): SavedQuote[] {
  if (!Array.isArray(raw)) { issues.push('quoteFavorites'); return [] }
  const result: SavedQuote[] = [], seen = new Set<string>()
  for (const q of raw) {
    if (!isRecord(q) || !isId(q.id) || !isId(q.copyVersion) || !isText(q.text, 4000) || (q.deletedAt === null ? !q.text.trim() : q.text !== '') ||
        !isCount(q.savedAt) || !isCount(q.rev) || q.rev < 1 || !(q.deletedAt === null || isCount(q.deletedAt)) ||
        !(q.category === undefined || isText(q.category, 128))) { issues.push('quoteFavorites.item'); continue }
    const quote: SavedQuote = { id: q.id, copyVersion: q.copyVersion, text: q.text, savedAt: q.savedAt, rev: q.rev, deletedAt: q.deletedAt,
      ...(q.category === undefined ? {} : { category: q.category }) }
    const key = quoteKey(quote)
    if (seen.has(key)) { issues.push('quoteFavorites.duplicate'); continue }
    seen.add(key); result.push(quote)
  }
  return result
}

export function readLastFocus(raw: unknown, spec: Spec, issues: string[]): number | null {
  if (raw === null) return null
  if (isValidDuration('focus', raw, spec)) return raw
  issues.push('lastFocusMinutes')
  return null
}

function readSceneRotation(raw: unknown, phase: 'focus' | 'rest', issues: string[]): SceneRotation {
  const validId = (id: unknown) => isSceneId(id) && (isFocusSceneId(id) === (phase === 'focus'))
  if (isRecord(raw) && isCount(raw.ordinal) && isCount(raw.cycle) && Array.isArray(raw.remaining) &&
      raw.remaining.every(validId) && new Set(raw.remaining).size === raw.remaining.length &&
      (raw.last === null || validId(raw.last))) {
    return { ordinal: raw.ordinal, cycle: raw.cycle, remaining: raw.remaining as SceneRotation['remaining'], last: raw.last as SceneRotation['last'] }
  }
  issues.push(`scenes.${phase}`)
  return initialScenes()[phase]
}

function readSceneIds(raw: unknown, name: string, issues: string[]): FocusSceneId[] {
  if (!Array.isArray(raw)) { issues.push(name); return [] }
  const valid = raw.filter(isFocusSceneId)
  if (valid.length !== raw.length) issues.push(name)
  return [...new Set(valid)]
}

export function readScenes(raw: unknown, issues: string[]): SceneState {
  if (!isRecord(raw)) { issues.push('scenes'); return initialScenes() }
  const unlocked: SceneUnlock[] = []
  const seen = new Set<string>()
  if (!Array.isArray(raw.unlocked)) issues.push('scenes.unlocked')
  else for (const unlock of raw.unlocked) {
    if (isRecord(unlock) && isFocusSceneId(unlock.sceneId) && isInstant(unlock.unlockedAt) &&
        isId(unlock.bySessionId) && isCount(unlock.ruleVersion) && unlock.ruleVersion > 0 && !seen.has(unlock.sceneId)) {
      seen.add(unlock.sceneId)
      unlocked.push({ sceneId: unlock.sceneId, unlockedAt: unlock.unlockedAt, bySessionId: unlock.bySessionId, ruleVersion: unlock.ruleVersion })
    } else issues.push('scenes.unlocked')
  }
  let lastEnded: SceneState['lastEnded'] = null
  if (raw.lastEnded !== null) {
    const end = raw.lastEnded
    const scene = isRecord(end) ? readSceneAssignment(end.scene) : null
    if (isRecord(end) && isId(end.sessionId) && (end.phase === 'focus' || end.phase === 'rest') &&
        scene && isFocusSceneId(scene.sceneId) === (end.phase === 'focus') && isInstant(end.elapsedMs) && isInstant(end.endedAt) &&
        (end.phase !== 'rest' || (isCount(end.elapsedMs) && isEpochMs(end.endedAt)))) {
      lastEnded = { sessionId: end.sessionId, phase: end.phase, scene, elapsedMs: end.elapsedMs, endedAt: end.endedAt }
    } else issues.push('scenes.lastEnded')
  }
  return {
    focus: readSceneRotation(raw.focus, 'focus', issues), rest: readSceneRotation(raw.rest, 'rest', issues),
    unlocked, introduced: readSceneIds(raw.introduced, 'scenes.introduced', issues),
    announced: readSceneIds(raw.announced, 'scenes.announced', issues), lastEnded,
  }
}
