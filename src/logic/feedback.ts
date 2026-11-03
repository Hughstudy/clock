export const NODE_POOLS = ['STA', 'PAU', 'RES', 'END', 'ZER', 'NME', 'NTX', 'BRK', 'BRE'] as const
export const ASK_POOLS = ['ASKG', 'ASKS', 'ASKB', 'ASKT'] as const
export const POOLS = [...NODE_POOLS, ...ASK_POOLS] as const
export type Pool = typeof POOLS[number]
export type AskPool = typeof ASK_POOLS[number]
export const COMPANION_STATES = ['focus-ready', 'focus-running', 'focus-paused', 'break-ready', 'break-running', 'break-paused'] as const
export type CompanionState = typeof COMPANION_STATES[number]
export const FACTS = ['operationSaved', 'focusStarted', 'positiveElapsed', 'zeroElapsed', 'participationSaved', 'emptyNote', 'textNote', 'explicitRequest', 'categorySelected'] as const
export type Fact = typeof FACTS[number]
const TAGS = ['autonomy', 'rest', 'stored', 'possibility', 'care', 'return', 'small-step', 'patience', 'presence'] as const

export interface Encouragement {
  readonly id: string
  readonly pool: Pool
  readonly text: string
  readonly level: 'light' | 'deep'
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

const ASK_ORDER = [1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 8]
const sequenceOf = (pool: Pool) => pool.startsWith('ASK') ? ASK_ORDER : [1, 2, 3, 4, 5]

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
    if (id !== `${pool}${String(index).padStart(2, '0')}` || !sequenceOf(pool as Pool).includes(index)) fail(`${id}.id`)
    text(e.text, `${id}.text`)
    if (/[{}<>]/.test(e.text as string)) fail(`${id}.text template/markup`)
    if (e.level !== (pool.startsWith('ASK') && index >= 9 ? 'deep' : 'light')) fail(`${id}.level`)
    if (e.copyVersion !== (pool.startsWith('ASK') ? requestedVersion : version) || e.reviewStatus !== 'candidate') fail(`${id}.metadata`)
    list(e.states, COMPANION_STATES, `${id}.states`)
    list(e.requiredFacts, FACTS, `${id}.requiredFacts`)
    list(e.tags, TAGS, `${id}.tags`)
  }
  // Each pool the reducer can pick from needs its whole rotation.
  for (const pool of POOLS) {
    for (const i of sequenceOf(pool)) if (!seen.has(`${pool}${String(i).padStart(2, '0')}`)) fail(`${pool}.coverage`)
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
}

type EventDetails =
  | { kind: 'focus-started' | 'paused' | 'resumed' | 'break-started' | 'break-ended' | 'dismissed' | 'reconcile' }
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
  cursors: Partial<Record<Pool, number>>
  lastIds: Partial<Record<Pool, string>>
  lastPool: Pool | null
  lastTags: readonly string[]
  lastInteractionAt: Partial<Record<'pause' | 'resume' | 'note', number>>
  handledKeys: readonly string[]
  handledInteractions: readonly string[]
}
export interface FeedbackResult {
  state: FeedbackMemory
  frame: FeedbackFrame
  announcement: { id: string; text: string; priority: 'polite' | 'assertive' } | null
}

export function createFeedbackMemory(): FeedbackMemory {
  return { current: null, cursors: {}, lastIds: {}, lastPool: null, lastTags: [], lastInteractionAt: {}, handledKeys: [], handledInteractions: [] }
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
    case 'focus-started': pool = 'STA'; add('focusStarted', true); break
    case 'paused': pool = 'PAU'; break
    case 'resumed': pool = 'RES'; break
    case 'focus-ended':
      if (Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0) {
        pool = event.elapsedMs === 0 ? 'ZER' : 'END'; add(event.elapsedMs === 0 ? 'zeroElapsed' : 'positiveElapsed', true)
      }
      break
    case 'note-saved': pool = event.hasText ? 'NTX' : 'NME'; add(event.hasText ? 'textNote' : 'emptyNote', true); break
    case 'break-started': pool = 'BRK'; break
    case 'break-ended': pool = 'BRE'; break
    case 'encouragement-requested':
      pool = event.category ?? 'ASKG'; add('explicitRequest', event.origin === 'user'); add('categorySelected', event.category !== undefined && event.origin === 'user'); break
  }
  return { pool, facts }
}

function choose(pool: Pool, facts: Set<Fact>, currentState: CompanionState, memory: FeedbackMemory, catalog: FeedbackCatalog): { entry: Encouragement; cursor: number } | null {
  const sequence = sequenceOf(pool)
  const start = memory.cursors[pool] ?? 0
  for (let n = 0; n < sequence.length; n++) {
    const cursor = (start + n) % sequence.length
    const id = `${pool}${String(sequence[cursor]).padStart(2, '0')}`
    const entry = catalog.entries.find(c => c.id === id)
    if (!entry || !entry.states.includes(currentState) || !entry.requiredFacts.every(f => facts.has(f)) || memory.lastIds[pool] === id) continue
    if (memory.lastPool && memory.lastPool !== pool && entry.tags.some(t => memory.lastTags.includes(t))) continue
    return { entry, cursor: (cursor + 1) % sequence.length }
  }
  return null
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
  const state: FeedbackMemory = { ...memory, cursors: { ...memory.cursors }, lastIds: { ...memory.lastIds }, lastInteractionAt: { ...memory.lastInteractionAt } }
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
  const group = event.kind === 'paused' ? 'pause' : event.kind === 'resumed' ? 'resume' : event.kind === 'note-saved' ? 'note' : null
  if (group) {
    const last = memory.lastInteractionAt[group]
    state.lastInteractionAt[group] = event.atMs
    const repeated = last !== undefined && event.atMs - last < cooldownMs
    const sameInteraction = event.interactionId !== undefined && memory.handledInteractions.includes(event.interactionId)
    if (event.interactionId) state.handledInteractions = retain(state.handledInteractions, event.interactionId)
    if (repeated || sameInteraction) return result(true)
  }
  const chosen = choose(pool, facts, companionState, memory, catalog)
  if (chosen) {
    frame.encouragement = chosen.entry
    state.cursors[pool] = chosen.cursor
    state.lastIds[pool] = chosen.entry.id
    state.lastPool = pool
    state.lastTags = chosen.entry.tags
  }
  return result(true)
}
