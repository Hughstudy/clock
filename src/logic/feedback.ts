import { isSceneId } from './scenes'
import type { SceneId } from './types'

export const COPY_FORMS = ['response', 'preference', 'observation', 'mini-story', 'small-report', 'invitation', 'practical', 'time-greeting'] as const
export const DAYPARTS = ['morning', 'afternoon', 'evening', 'night'] as const
export interface CopyConditions {
  readonly dayparts?: readonly typeof DAYPARTS[number][]
  readonly focusMinutes?: readonly [number, number]
  readonly scenes?: readonly SceneId[]
}

export const NODE_POOLS = ['RET', 'STA', 'END', 'ZER', 'BRK'] as const
export const ASK_POOLS = ['ASKG', 'ASKS', 'ASKB', 'ASKT'] as const
export const POOLS = [...NODE_POOLS, ...ASK_POOLS] as const
export type Pool = typeof POOLS[number]
export type AskPool = typeof ASK_POOLS[number]
export const COMPANION_STATES = ['focus-ready', 'focus-running', 'focus-paused', 'break-ready', 'break-running', 'break-paused'] as const
export type CompanionState = typeof COMPANION_STATES[number]
export const FACTS = ['operationSaved', 'returningReady', 'focusStarted', 'positiveElapsed', 'zeroElapsed', 'participationSaved', 'emptyNote', 'textNote', 'explicitRequest', 'categorySelected'] as const
export type Fact = typeof FACTS[number]
const TAGS = ['autonomy', 'rest', 'stored', 'possibility', 'care', 'return', 'small-step', 'patience', 'presence'] as const

export interface Encouragement {
  readonly id: string
  readonly pool: Pool
  readonly text: string
  readonly level: 'light' | 'deep'
  /** Editorial descriptors, never a user's mood or a selection order. */
  readonly form: typeof COPY_FORMS[number]
  readonly topic: string
  readonly when?: CopyConditions
  readonly states: readonly CompanionState[]
  readonly requiredFacts: readonly Fact[]
  readonly tags: readonly string[]
  readonly copyVersion: string
  readonly reviewStatus: 'candidate'
}
interface FixedCopy { readonly id: string; readonly text: string }
export interface FeedbackCatalog {
  readonly schemaVersion: 1
  readonly copyVersion: string
  readonly requestedCopyVersion: string
  readonly reviewStatus: 'candidate'
  readonly entries: readonly Encouragement[]
  readonly interfaceCopy: readonly FixedCopy[]
  readonly errors: readonly FixedCopy[]
  readonly welcomeNote: { readonly id: 'WELCOME_NOTE'; readonly text: string; readonly copyVersion: string; readonly reviewStatus: 'candidate' }
}

/** Validate local editable content before any candidate can be selected. */
export function parseFeedbackCatalog(value: unknown): FeedbackCatalog {
  const fail = (path: string): never => { throw new Error(`feedback catalog: invalid ${path}`) }
  const object = (v: unknown, path: string): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(path)
    return v as Record<string, unknown>
  }
  const text = (v: unknown, path: string): string => typeof v === 'string' && v.trim() ? v : fail(path)
  const list = (v: unknown, allowed: readonly string[], path: string): string[] => {
    if (!Array.isArray(v) || !v.length || v.some(x => typeof x !== 'string' || !allowed.includes(x)) || new Set(v).size !== v.length) return fail(path)
    return v as string[]
  }
  const root = object(value, '$')
  if (root.schemaVersion !== 1 || root.reviewStatus !== 'candidate') fail('schemaVersion/reviewStatus')
  const version = text(root.copyVersion, 'copyVersion')
  const requestedVersion = text(root.requestedCopyVersion, 'requestedCopyVersion')
  if (!Array.isArray(root.entries)) fail('entries')
  const seen = new Set<string>()
  for (const item of root.entries as unknown[]) {
    const e = object(item, 'entry')
    const id = text(e.id, 'id')
    const pool = text(e.pool, `${id}.pool`)
    if (!POOLS.includes(pool as Pool) || seen.has(id)) fail(`${id}.pool/duplicate`)
    seen.add(id)
    const index = Number(id.slice(pool.length))
    if (id !== `${pool}${String(index).padStart(2, '0')}` || !Number.isSafeInteger(index) || index < 1) fail(`${id}.id`)
    text(e.text, `${id}.text`)
    if (/[{}<>]/.test(e.text as string)) fail(`${id}.text template/markup`)
    if (!['light', 'deep'].includes(e.level as string)) fail(`${id}.level`)
    if (!COPY_FORMS.includes(e.form as typeof COPY_FORMS[number])) fail(`${id}.form`)
    text(e.topic, `${id}.topic`)
    if (e.when !== undefined) {
      const when = object(e.when, `${id}.when`)
      if (!Object.keys(when).length || Object.keys(when).some(k => !['dayparts', 'focusMinutes', 'scenes'].includes(k))) fail(`${id}.when.keys`)
      if (when.dayparts !== undefined) {
        if (!['RET', 'STA', 'BRK'].includes(pool)) fail(`${id}.when.dayparts.pool`)
        list(when.dayparts, DAYPARTS, `${id}.when.dayparts`)
      }
      if (when.focusMinutes !== undefined) {
        const bounds = when.focusMinutes
        if (pool !== 'STA' || !Array.isArray(bounds) || bounds.length !== 2 ||
          bounds.some(n => !Number.isInteger(n) || n < 1 || n > 120) || bounds[0] > bounds[1]) fail(`${id}.when.focusMinutes`)
      }
      if (when.scenes !== undefined) {
        const scenes = when.scenes
        if (!['STA', 'BRK'].includes(pool) || !Array.isArray(scenes) || !scenes.length ||
          new Set(scenes).size !== scenes.length || scenes.some(id => !isSceneId(id) || !id.startsWith(pool === 'STA' ? 'F' : 'R'))) fail(`${id}.when.scenes`)
      }
    }
    if (e.copyVersion !== (pool.startsWith('ASK') ? requestedVersion : version) || e.reviewStatus !== 'candidate') fail(`${id}.metadata`)
    list(e.states, COMPANION_STATES, `${id}.states`)
    list(e.requiredFacts, FACTS, `${id}.requiredFacts`)
    list(e.tags, TAGS, `${id}.tags`)
  }
  // Pool size and short/long mix belong to the catalog, not a hard-coded sequence.
  for (const pool of POOLS) {
    const entries = (root.entries as Encouragement[]).filter(e => e.pool === pool)
    if (entries.filter(e => !e.when).length < 2 || new Set(entries.map(e => e.text)).size !== entries.length) fail(`${pool}.coverage`)
    if (pool.startsWith('ASK')) {
      for (const state of COMPANION_STATES) {
        if (entries.filter(e => e.states.includes(state) && e.requiredFacts.every(f => f === 'explicitRequest' || f === 'categorySelected')).length < 2) fail(`${pool}.${state}.coverage`)
      }
    }
  }
  for (const key of ['interfaceCopy', 'errors'] as const) {
    if (!Array.isArray(root[key])) fail(key)
    const ids = new Set<string>()
    for (const item of root[key] as unknown[]) {
      const c = object(item, key)
      const id = text(c.id, `${key}.id`)
      if (ids.has(id)) fail(`${key}.${id}.duplicate`)
      ids.add(id)
      text(c.text, `${key}.${id}.text`)
    }
  }
  const note = object(root.welcomeNote, 'welcomeNote')
  if (note.id !== 'WELCOME_NOTE' || note.copyVersion !== version || note.reviewStatus !== 'candidate') fail('welcomeNote.metadata')
  text(note.text, 'welcomeNote.text')
  return value as FeedbackCatalog
}

export const DEFAULT_FEEDBACK_OPTIONS = { nodeEncouragement: true, cooldownMs: 30_000 } as const
export interface FeedbackOptions { nodeEncouragement?: boolean; cooldownMs?: number }
export type Persistence = 'saved' | 'saving' | 'pending' | 'memory-only' | 'read-only'

/** The host supplies facts from the committed model, never from an animation. */
export interface FeedbackContext {
  phase: 'focus' | 'break'
  status: 'ready' | 'running' | 'paused'
  persistence: Persistence
  participationSaved?: boolean
  returningReady?: boolean
  /** Actual presentation-time local hour supplied by the adapter. Missing means generic copy only. */
  localHour?: number | undefined
  focusDurationMs?: number | undefined
  sceneId?: SceneId | undefined
}

type EventDetails =
  | { kind: 'ready-entered' | 'focus-started' | 'paused' | 'resumed' | 'break-started' | 'break-ended' | 'dismissed' | 'reconcile' }
  | { kind: 'focus-ended'; elapsedMs: number; reason: 'manual' | 'elapsed' }
  | { kind: 'note-saved'; hasText: boolean }
  | { kind: 'encouragement-requested'; category?: AskPool }
export type FeedbackEvent = EventDetails & {
  id: string
  atMs: number
  origin: 'user' | 'expiry' | 'restore' | 'sync'
  /** One ID for a save-and-return interaction; share it across its child results. */
  interactionId?: string
}
export interface FeedbackMessage {
  id: string
  text: string
  kind: 'status' | 'error'
}
export interface FeedbackFrame {
  status: FeedbackMessage
  encouragement: Encouragement | null
  placement: 'node' | 'requested'
  companionState: CompanionState
  persistence: Persistence
}
export interface FeedbackMemory {
  current: FeedbackFrame | null
  randomState: number
  lastAutomaticAt: number | null
  lastIds: Partial<Record<Pool, string>>
  handledKeys: readonly string[]
}
export interface FeedbackResult {
  state: FeedbackMemory
  frame: FeedbackFrame
  announcement: { id: string; text: string; priority: 'polite' | 'assertive' } | null
}

export function createFeedbackMemory(seed = 1): FeedbackMemory {
  if (!Number.isFinite(seed)) throw new Error('feedback seed must be finite')
  return { current: null, randomState: seed >>> 0, lastAutomaticAt: null, lastIds: {}, handledKeys: [] }
}

function ui(id: string, catalog: FeedbackCatalog): FeedbackMessage {
  const item = catalog.interfaceCopy.find(c => c.id === id)!
  return { id, text: item.text, kind: 'status' }
}
function status(context: FeedbackContext, catalog: FeedbackCatalog): FeedbackMessage {
  if (context.status === 'paused') return context.phase === 'focus' ? ui('UI26', catalog) : { id: 'break-paused', text: '休息已暂停。', kind: 'status' }
  if (context.status === 'running') return context.phase === 'focus' ? ui('UI27', catalog) : { id: 'break-running', text: '休息计时中。', kind: 'status' }
  return { id: 'ready', text: '准备好时，可以开始一段或休息。', kind: 'status' }
}

function technicalStatus(context: FeedbackContext): FeedbackMessage | null {
  const messages: Partial<Record<Persistence, string>> = {
    saving: '正在保存。', pending: '本次更改尚未保存，请保留当前页面后重试。',
    'memory-only': '本次更改仅保留在当前页面，关闭后可能丢失。',
    'read-only': '当前数据暂时无法写入。',
  }
  const text = messages[context.persistence]
  return text ? { id: context.persistence, text, kind: context.persistence === 'saving' ? 'status' : 'error' } : null
}

function elapsedText(ms: number): string {
  if (ms < 1000) return '不到1秒'
  const seconds = Math.floor(ms / 1000)
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60
  return `${h ? `${h}小时` : ''}${m ? `${m}分钟` : ''}${s ? `${s}秒` : ''}`
}

function eventStatus(event: FeedbackEvent, context: FeedbackContext, catalog: FeedbackCatalog): FeedbackMessage {
  if (event.kind === 'focus-ended' && Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0 && context.status === 'ready') {
    return event.elapsedMs === 0 ? ui('UI31', catalog) : { ...ui('UI30', catalog), text: ui('UI30', catalog).text.replace('{elapsed}', elapsedText(event.elapsedMs)) }
  }
  if (event.kind === 'note-saved') return ui(event.hasText ? 'UI33' : 'UI32', catalog)
  if (event.kind === 'break-ended' && context.status === 'ready') return ui('UI36', catalog)
  return status(context, catalog)
}

function eligibility(event: FeedbackEvent, context: FeedbackContext): { pool: Pool | null; facts: Set<Fact> } {
  const facts = new Set<Fact>()
  const add = (fact: Fact, yes: boolean | undefined) => { if (yes) facts.add(fact) }
  add('operationSaved', context.persistence === 'saved')
  add('participationSaved', context.participationSaved)
  let pool: Pool | null = null
  switch (event.kind) {
    case 'ready-entered': pool = 'RET'; add('returningReady', context.returningReady); break
    case 'focus-started': pool = 'STA'; add('focusStarted', true); break
    case 'focus-ended':
      if (Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0) {
        pool = event.elapsedMs === 0 ? 'ZER' : 'END'; add(event.elapsedMs === 0 ? 'zeroElapsed' : 'positiveElapsed', true)
      }
      break
    case 'break-started': pool = 'BRK'; break
    case 'encouragement-requested':
      pool = event.category ?? 'ASKG'; add('explicitRequest', event.origin === 'user'); add('categorySelected', event.category !== undefined && event.origin === 'user'); break
  }
  return { pool, facts }
}

/** Context only filters authored facts; it does not infer feelings or award content. */
export function copyFitsContext(entry: Encouragement, context: FeedbackContext): boolean {
  const when = entry.when
  if (!when) return true
  if (when.dayparts) {
    const hour = context.localHour
    if (hour === undefined || !Number.isInteger(hour) || hour < 0 || hour > 23) return false
    const daypart = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
    if (!when.dayparts.includes(daypart)) return false
  }
  if (when.focusMinutes) {
    const duration = context.focusDurationMs
    if (context.phase !== 'focus' || duration === undefined || !Number.isFinite(duration) ||
      duration < when.focusMinutes[0] * 60_000 || duration > when.focusMinutes[1] * 60_000) return false
  }
  if (when.scenes && (!context.sceneId || !when.scenes.includes(context.sceneId))) return false
  return true
}

function choose(pool: Pool, facts: Set<Fact>, currentState: CompanionState, memory: FeedbackMemory, catalog: FeedbackCatalog, context: FeedbackContext) {
  const eligible = catalog.entries.filter(e => e.pool === pool && e.states.includes(currentState) && e.requiredFacts.every(f => facts.has(f)) && copyFitsContext(e, context) && e.id !== memory.lastIds[pool])
  if (!eligible.length) return null
  // Independent draws, not a shuffled bag. The host supplies a fresh seed each
  // time the app opens; only the immediately previous phrase in this pool is excluded.
  const randomState = (Math.imul(memory.randomState, 1664525) + 1013904223) >>> 0
  const entry = eligible[Math.floor(randomState / 0x1_0000_0000 * eligible.length)]!
  return { entry, randomState }
}

const retain = (items: readonly string[], value: string) => [...items, value].slice(-128)

/** Pure, event-driven reducer. Keep memory above page routing. No timer, storage or random effects. */
export function transitionFeedback(memory: FeedbackMemory, event: FeedbackEvent, context: FeedbackContext, catalog: FeedbackCatalog, options: FeedbackOptions = {}): FeedbackResult {
  if (!event.id.trim() || !Number.isFinite(event.atMs)) throw new Error('feedback event needs a stable id and finite atMs')
  const cooldownMs = options.cooldownMs ?? DEFAULT_FEEDBACK_OPTIONS.cooldownMs
  if (!Number.isFinite(cooldownMs) || cooldownMs < 0) throw new Error('feedback cooldownMs must be nonnegative')
  const companionState: CompanionState = `${context.phase}-${context.status}`
  const technical = technicalStatus(context)
  const restored = event.origin === 'restore' || event.origin === 'sync'
  const key = JSON.stringify([event.id, context.persistence])
  const duplicate = memory.handledKeys.includes(key)
  const requested = event.kind === 'encouragement-requested' && event.origin === 'user'
  const reading = !requested && event.kind !== 'dismissed' && memory.current?.placement === 'requested'
    ? memory.current.encouragement : null
  const state: FeedbackMemory = { ...memory, lastIds: { ...memory.lastIds } }
  let frame: FeedbackFrame = { status: technical ?? status(context, catalog), encouragement: null, placement: 'node', companionState, persistence: context.persistence }
  const result = (announce: boolean): FeedbackResult => {
    if (reading) frame = { ...frame, placement: 'requested', encouragement: reading }
    state.current = frame
    const text = [frame.status.text, reading ? null : frame.encouragement?.text].filter(Boolean).join(' ')
    return { state, frame, announcement: announce ? { id: key, text, priority: frame.status.kind === 'error' ? 'assertive' : 'polite' } : null }
  }
  if (event.kind === 'dismissed') return result(false)
  if (restored) {
    if (!technical && context.status !== 'ready') frame.status = ui(context.status === 'paused' ? 'UI28' : 'UI29', catalog)
    // Recovered break states use rest-specific copy, never imply a focus session.
    if (!technical && context.phase === 'break') frame.status = status(context, catalog)
    return result(false)
  }
  if (event.kind === 'reconcile' || duplicate) {
    const previous = memory.current
    if (previous?.companionState === companionState) {
      if (!technical && previous.persistence === context.persistence && previous.status.kind !== 'error') frame = previous
      else if (previous.placement === 'requested') frame = { ...frame, placement: 'requested', encouragement: previous.encouragement }
    }
    const changedError = technical?.kind === 'error' && (previous?.status.id !== technical.id || previous?.status.text !== technical.text)
    return result(Boolean(changedError))
  }
  state.handledKeys = retain(state.handledKeys, key)
  const permittedOrigin = event.origin === 'user' || (event.origin === 'expiry' && ['focus-ended', 'break-ended'].includes(event.kind))
  if (!permittedOrigin) return result(false)
  if (technical && !requested) return result(true)
  if (!technical) frame.status = eventStatus(event, context, catalog)
  if (reading) return result(true)
  frame.placement = requested ? 'requested' : 'node'
  const { pool, facts } = eligibility(event, context)
  const enabled = options.nodeEncouragement ?? DEFAULT_FEEDBACK_OPTIONS.nodeEncouragement
  if (!pool || (!enabled && !requested)) return result(true)
  if (['paused', 'resumed', 'note-saved', 'break-ended'].includes(event.kind)) return result(true)
  if (!requested && memory.lastAutomaticAt !== null && event.atMs - memory.lastAutomaticAt < cooldownMs) return result(true)
  const chosen = choose(pool, facts, companionState, memory, catalog, context)
  if (chosen) {
    frame.encouragement = chosen.entry
    state.randomState = chosen.randomState
    if (!requested) state.lastAutomaticAt = event.atMs
    state.lastIds[pool] = chosen.entry.id
  }
  return result(true)
}
