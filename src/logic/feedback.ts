export const NODE_POOLS = ['WEL', 'RET', 'STA', 'PAU', 'RES', 'END', 'ZER', 'NME', 'NTX', 'BCK', 'BRK', 'BRE', 'REV', 'EMP', 'MEM', 'NEW'] as const
export const ASK_POOLS = ['ASKG', 'ASKS', 'ASKB', 'ASKT'] as const
export const POOLS = [...NODE_POOLS, ...ASK_POOLS] as const
export type Pool = typeof POOLS[number]
export type AskPool = typeof ASK_POOLS[number]
export const COMPANION_STATES = ['focus-ready', 'focus-running', 'focus-paused', 'break-ready', 'break-running', 'break-paused'] as const
export type CompanionState = typeof COMPANION_STATES[number]
export const FACTS = ['initialized', 'firstVisit', 'returnVisit', 'operationSaved', 'focusStarted', 'positiveElapsed', 'zeroElapsed', 'participationSaved', 'emptyNote', 'textNote', 'returnedToSession', 'historyReadable', 'hasRecords', 'noRecords', 'mementoSaved', 'explicitView', 'rewardApproved', 'rewardContentReady', 'rewardSaved', 'quietRewardMoment', 'explicitRequest', 'categorySelected'] as const
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
  readonly collectible: boolean
  readonly reviewStatus: 'candidate'
}
interface FixedCopy { readonly id: string; readonly text: string; readonly condition: string }
interface ErrorCopy extends FixedCopy { readonly suggestedAction: string }
export interface FeedbackCatalog {
  readonly schemaVersion: 1
  readonly copyVersion: string
  readonly reviewStatus: 'candidate'
  readonly entries: readonly Encouragement[]
  readonly interfaceCopy: readonly FixedCopy[]
  readonly errors: readonly ErrorCopy[]
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
  if (!Array.isArray(root.entries) || root.entries.length !== 136) fail('entries count')
  const seen = new Set<string>()
  for (const item of root.entries as unknown[]) {
    const e = object(item, 'entry')
    const id = text(e.id, 'id')
    const pool = text(e.pool, `${id}.pool`)
    if (!POOLS.includes(pool as Pool) || seen.has(id)) fail(`${id}.pool/duplicate`)
    seen.add(id)
    const count = pool.startsWith('ASK') ? 14 : 5
    const index = Number(id.slice(pool.length))
    if (id !== `${pool}${String(index).padStart(2, '0')}` || !Number.isInteger(index) || index < 1 || index > count) fail(`${id}.id`)
    text(e.text, `${id}.text`)
    if (/[{}<>]/.test(e.text as string)) fail(`${id}.text template/markup`)
    if (e.level !== (pool.startsWith('ASK') && index >= 9 ? 'deep' : 'light')) fail(`${id}.level`)
    if (e.copyVersion !== version || e.reviewStatus !== 'candidate' || typeof e.collectible !== 'boolean') fail(`${id}.metadata`)
    list(e.states, COMPANION_STATES, `${id}.states`)
    list(e.requiredFacts, FACTS, `${id}.requiredFacts`)
    list(e.tags, TAGS, `${id}.tags`)
  }
  for (const pool of POOLS) {
    for (let i = 1; i <= (pool.startsWith('ASK') ? 14 : 5); i++) {
      if (!seen.has(`${pool}${String(i).padStart(2, '0')}`)) fail(`${pool}.coverage`)
    }
  }
  for (const [key, prefix, count] of [['interfaceCopy', 'UI', 44], ['errors', 'ERR', 14]] as const) {
    const items = root[key]
    if (!Array.isArray(items) || items.length !== count) fail(`${key}.count`)
    const ids = new Set<string>()
    for (const item of items as unknown[]) {
      const c = object(item, key)
      ids.add(text(c.id, `${key}.id`))
      text(c.text, `${key}.text`)
      text(c.condition, `${key}.condition`)
      if (prefix === 'ERR') text(c.suggestedAction, 'suggestedAction')
    }
    for (let i = 1; i <= count; i++) if (!ids.has(`${prefix}${String(i).padStart(2, '0')}`)) fail(`${key}.coverage`)
  }
  const note = object(root.welcomeNote, 'welcomeNote')
  if (note.id !== 'WELCOME_NOTE' || note.copyVersion !== version || note.reviewStatus !== 'candidate') fail('welcomeNote.metadata')
  text(note.text, 'welcomeNote.text')
  return value as FeedbackCatalog
}

const ASK_ORDER = [1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 8]
export const DEFAULT_FEEDBACK_OPTIONS = { nodeEncouragement: true, cooldownMs: 30_000 } as const
export interface FeedbackOptions { nodeEncouragement?: boolean; cooldownMs?: number }
export type Persistence = 'saved' | 'saving' | 'pending' | 'memory-only' | 'read-only' | 'unavailable' | 'unknown'
export type ErrorId = `ERR${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14'}`

/** The host supplies facts from the committed model, never from an animation. */
export interface FeedbackContext {
  phase: 'focus' | 'break'
  status: 'ready' | 'running' | 'paused'
  persistence: Persistence
  initialized: boolean
  history?: 'unknown' | 'empty' | 'nonempty' | 'filtered-empty'
  participationSaved?: boolean
  mementoSaved?: boolean
  rewardApproved?: boolean
  rewardContentReady?: boolean
  rewardSaved?: boolean
  error?: ErrorId
  draftRetained?: boolean
  originalDataUnchanged?: boolean
  focusMinuteBounds?: readonly [number, number]
}

type EventDetails =
  | { kind: 'welcome'; firstVisit: boolean }
  | { kind: 'focus-started' | 'paused' | 'resumed' | 'returned' | 'break-started' | 'break-ended' | 'records-viewed' | 'memento-viewed' | 'dismissed' | 'reconcile' }
  | { kind: 'focus-ended'; elapsedMs: number; reason: 'manual' | 'elapsed' }
  | { kind: 'note-saved'; hasText: boolean }
  | { kind: 'new-content'; explicitlyViewed: boolean }
  | { kind: 'encouragement-requested'; category?: AskPool }
export type FeedbackEvent = EventDetails & {
  id: string
  atMs: number
  origin: 'user' | 'expiry' | 'restore' | 'sync' | 'navigation'
  /** One ID for a save-and-return interaction; share it across its child results. */
  interactionId?: string
}
export interface FeedbackMessage {
  id: string
  text: string
  kind: 'status' | 'error'
  /** The factual outcome of an action (recorded time, saved thought). Shown alongside any encouragement, never hidden by it. */
  result?: true
}
export interface FeedbackFrame {
  status: FeedbackMessage
  encouragement: Encouragement | null
  placement: 'node' | 'requested' | 'static'
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
  staticChoices: Partial<Record<Pool, Encouragement>>
}
export interface FeedbackResult {
  state: FeedbackMemory
  frame: FeedbackFrame
  announcement: { id: string; text: string; priority: 'polite' | 'assertive' } | null
}

export function createFeedbackMemory(): FeedbackMemory {
  return { current: null, cursors: {}, lastIds: {}, lastPool: null, lastTags: [], lastInteractionAt: {}, handledKeys: [], handledInteractions: [], staticChoices: {} }
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

function technicalStatus(context: FeedbackContext, catalog: FeedbackCatalog): FeedbackMessage | null {
  if (context.error) {
    const item = catalog.errors.find(e => e.id === context.error)!
    let text = item.text
    if (context.error === 'ERR04' && context.draftRetained !== true) text = '这条想法还没保存成功，暂时无法确认草稿是否保留。'
    if (context.error === 'ERR09' && context.originalDataUnchanged !== true) text = '恢复未完成，暂时无法确认原有数据是否改变。'
    if (context.error === 'ERR11') {
      const bounds = context.focusMinuteBounds
      text = bounds && bounds.every(Number.isInteger) && bounds[0] > 0 && bounds[1] >= bounds[0]
        ? `专注时长可以设为${bounds[0]}到${bounds[1]}之间的整数分钟。`
        : '专注时长无效，请检查允许的设置范围。'
    }
    return { id: item.id, text, kind: 'error' }
  }
  const messages: Partial<Record<Persistence, string>> = {
    saving: '正在保存。', pending: '本次更改尚未保存，请保留当前页面后重试。',
    'memory-only': '本次更改仅保留在当前页面，关闭后可能丢失。',
    'read-only': '当前数据暂时无法写入。', unavailable: '暂时无法读取或保存数据。', unknown: '暂时无法确认保存状态。',
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
  const result = (message: FeedbackMessage): FeedbackMessage => ({ ...message, result: true })
  if (event.kind === 'focus-ended' && Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0 && context.status === 'ready') {
    return result(event.elapsedMs === 0 ? ui('UI31', catalog) : { ...ui('UI30', catalog), text: ui('UI30', catalog).text.replace('{elapsed}', elapsedText(event.elapsedMs)) })
  }
  if (event.kind === 'note-saved') return result(ui(event.hasText ? 'UI33' : 'UI32', catalog))
  if (event.kind === 'break-ended' && context.status === 'ready') return result(ui('UI36', catalog))
  if (event.kind === 'records-viewed') {
    if (context.history === 'filtered-empty') return ui('UI37', catalog)
    if (context.history === 'empty') return { id: 'records-empty', text: '还没有计时记录。', kind: 'status' }
    if (context.history !== 'nonempty') return { id: 'history-unknown', text: '暂时无法确认历史记录。', kind: 'error' }
  }
  return status(context, catalog)
}

function eligibility(event: FeedbackEvent, context: FeedbackContext): { pool: Pool | null; facts: Set<Fact> } {
  const facts = new Set<Fact>()
  const add = (fact: Fact, yes: boolean | undefined) => { if (yes) facts.add(fact) }
  add('initialized', context.initialized)
  add('operationSaved', context.persistence === 'saved' && !context.error)
  add('participationSaved', context.participationSaved)
  add('mementoSaved', context.mementoSaved)
  add('historyReadable', context.history !== undefined && context.history !== 'unknown')
  add('hasRecords', context.history === 'nonempty')
  add('noRecords', context.history === 'empty')
  add('rewardApproved', context.rewardApproved)
  add('rewardContentReady', context.rewardContentReady)
  add('rewardSaved', context.rewardSaved)
  let pool: Pool | null = null
  switch (event.kind) {
    case 'welcome': pool = event.firstVisit ? 'WEL' : 'RET'; add(event.firstVisit ? 'firstVisit' : 'returnVisit', true); break
    case 'focus-started': pool = 'STA'; add('focusStarted', true); break
    case 'paused': pool = 'PAU'; break
    case 'resumed': pool = 'RES'; break
    case 'focus-ended':
      if (Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0) {
        pool = event.elapsedMs === 0 ? 'ZER' : 'END'; add(event.elapsedMs === 0 ? 'zeroElapsed' : 'positiveElapsed', true)
      }
      break
    case 'note-saved': pool = event.hasText ? 'NTX' : 'NME'; add(event.hasText ? 'textNote' : 'emptyNote', true); break
    case 'returned': pool = 'BCK'; add('returnedToSession', true); break
    case 'break-started': pool = 'BRK'; break
    case 'break-ended': pool = 'BRE'; break
    case 'records-viewed': pool = context.history === 'empty' ? 'EMP' : context.history === 'nonempty' ? 'REV' : null; break
    case 'memento-viewed': pool = 'MEM'; add('explicitView', event.origin === 'user'); break
    case 'new-content':
      pool = 'NEW'
      add('quietRewardMoment', context.status !== 'running' || (event.explicitlyViewed && event.origin === 'user'))
      break
    case 'encouragement-requested':
      pool = event.category ?? 'ASKG'; add('explicitRequest', event.origin === 'user'); add('categorySelected', event.category !== undefined && event.origin === 'user'); break
  }
  return { pool, facts }
}

function choose(pool: Pool, facts: Set<Fact>, currentState: CompanionState, memory: FeedbackMemory, catalog: FeedbackCatalog): { entry: Encouragement; cursor: number } | null {
  const sequence = pool.startsWith('ASK') ? ASK_ORDER : [1, 2, 3, 4, 5]
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
  const technical = technicalStatus(context, catalog)
  const restored = event.origin === 'restore' || event.origin === 'sync'
  const key = JSON.stringify([event.id, context.persistence, context.error ?? null])
  const duplicate = memory.handledKeys.includes(key)
  const requested = event.kind === 'encouragement-requested' && event.origin === 'user'
  const reading = !requested && event.kind !== 'dismissed' && memory.current?.placement === 'requested'
    ? memory.current.encouragement : null
  const staticEvent = event.kind === 'records-viewed' || event.kind === 'memento-viewed'
  const state: FeedbackMemory = { ...memory, cursors: { ...memory.cursors }, lastIds: { ...memory.lastIds }, lastInteractionAt: { ...memory.lastInteractionAt }, staticChoices: { ...memory.staticChoices } }
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
  // Navigation can render static context, but cannot manufacture action feedback.
  const permittedOrigin = event.origin === 'user' || (event.origin === 'expiry' && ['focus-ended', 'break-ended'].includes(event.kind)) || (event.origin === 'navigation' && (staticEvent || event.kind === 'welcome'))
  if (!permittedOrigin) return result(false)
  if (technical && !requested) return result(!staticEvent)
  if (!technical) frame.status = eventStatus(event, context, catalog)
  if (frame.status.kind === 'error' && !requested) return result(!staticEvent)
  if (reading) return result(!staticEvent)
  frame.placement = requested ? 'requested' : staticEvent ? 'static' : 'node'
  const { pool, facts } = eligibility(event, context)
  const enabled = options.nodeEncouragement ?? DEFAULT_FEEDBACK_OPTIONS.nodeEncouragement
  if (!pool || (!enabled && !requested)) return result(!staticEvent)
  const group = event.kind === 'paused' ? 'pause' : event.kind === 'resumed' ? 'resume' : ['note-saved', 'returned'].includes(event.kind) ? 'note' : null
  if (group) {
    const last = memory.lastInteractionAt[group]
    state.lastInteractionAt[group] = event.atMs
    const repeated = last !== undefined && event.atMs - last < cooldownMs
    const sameInteraction = event.interactionId !== undefined && memory.handledInteractions.includes(event.interactionId)
    if (event.interactionId) state.handledInteractions = retain(state.handledInteractions, event.interactionId)
    if (repeated || sameInteraction) return result(true)
  }
  const cached = staticEvent ? memory.staticChoices[pool] : undefined
  const chosen = cached && cached.states.includes(companionState) && cached.requiredFacts.every(f => facts.has(f))
    ? { entry: cached, cursor: state.cursors[pool] ?? 0 }
    : choose(pool, facts, companionState, memory, catalog)
  if (chosen) {
    frame.encouragement = chosen.entry
    state.cursors[pool] = chosen.cursor
    state.lastIds[pool] = chosen.entry.id
    state.lastPool = pool
    state.lastTags = chosen.entry.tags
    if (staticEvent) state.staticChoices[pool] = chosen.entry
  }
  return result(!staticEvent)
}

/** Prepare a snapshot for the host's save command; this does not mark it as saved. */
export function createEncouragementBookmark(entry: Encouragement) {
  if (!entry.collectible) throw new Error('This copy is not collectible')
  return { copyId: entry.id, text: entry.text, copyVersion: entry.copyVersion }
}
