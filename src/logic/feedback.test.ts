import { describe, expect, it } from 'vitest'
import raw from '../data/encouragement.zh-CN.json'
import { feedbackCatalog } from '../data/encouragement'
import { ASK_POOLS, NODE_POOLS, createFeedbackMemory, parseFeedbackCatalog, transitionFeedback, type FeedbackContext, type FeedbackEvent, type FeedbackMemory } from './feedback'

const ready: FeedbackContext = { phase: 'focus', status: 'ready', persistence: 'saved', participationSaved: true }
const running: FeedbackContext = { ...ready, status: 'running' }
const paused: FeedbackContext = { ...ready, status: 'paused' }
const event = (details: Omit<FeedbackEvent, 'id' | 'atMs' | 'origin'> & Record<string, unknown>, id = 'a', atMs = 0): FeedbackEvent => ({ id, atMs, origin: 'user', ...details }) as FeedbackEvent
const reduce = (e: FeedbackEvent, c = ready, m = createFeedbackMemory(), options = {}) => transitionFeedback(m, e, c, feedbackCatalog, options)

describe('PRD copy resource integrity', () => {
  it('contains the exact pool coverage, candidate status and deep/light separation', () => {
    for (const pool of NODE_POOLS) expect(feedbackCatalog.entries.filter(e => e.pool === pool)).toHaveLength(5)
    for (const pool of ASK_POOLS) expect(feedbackCatalog.entries.filter(e => e.pool === pool)).toHaveLength(14)
    expect(feedbackCatalog.entries.filter(e => e.level === 'deep')).toHaveLength(24)
    expect(feedbackCatalog.entries.every(e => e.reviewStatus === 'candidate')).toBe(true)
  })

  it('versions the companion’s spoken lines independently from automatic and welcome copy', () => {
    for (const entry of feedbackCatalog.entries) {
      if (entry.pool.startsWith('ASK')) {
        expect(entry.copyVersion).toBe('companion-voice-v1')
        expect(entry.text).toContain('我')
      } else expect(entry.copyVersion).toBe('prd-v3-r7')
    }
    expect(feedbackCatalog.welcomeNote.copyVersion).toBe('prd-v3-r7')
  })

  it.each(['id', 'facts', 'states', 'version', 'requested-version', 'markup', 'missing', 'deep', 'ui', 'error'] as const)('rejects damaged %s before use', kind => {
    const bad = structuredClone(raw)
    if (kind === 'id') bad.entries[1]!.id = bad.entries[0]!.id
    if (kind === 'facts') bad.entries[0]!.requiredFacts = ['guessedTired']
    if (kind === 'states') bad.entries[0]!.states = ['cry']
    if (kind === 'version') bad.entries[0]!.copyVersion = 'unknown'
    if (kind === 'requested-version') bad.entries.find(e => e.pool === 'ASKG')!.copyVersion = bad.copyVersion
    if (kind === 'markup') bad.entries[0]!.text = '<script>alert(1)</script>'
    if (kind === 'missing') bad.entries.pop()
    if (kind === 'deep') bad.entries[0]!.level = 'deep'
    if (kind === 'ui') bad.interfaceCopy[0]!.id = bad.interfaceCopy[1]!.id
    if (kind === 'error') bad.errors[0]!.text = ' '
    expect(() => parseFeedbackCatalog(bad)).toThrow(/feedback catalog/)
  })
})

describe('truthful feedback eligibility', () => {
  it('starts at each pool’s first candidate with the facts it needs', () => {
    const cases: [FeedbackEvent, FeedbackContext, string][] = [
      [event({ kind: 'focus-started' }), running, 'STA01'],
      [event({ kind: 'paused' }), paused, 'PAU01'],
      [event({ kind: 'resumed' }), running, 'RES01'],
      [event({ kind: 'focus-ended', elapsedMs: 1000, reason: 'manual' }), ready, 'END01'],
      [event({ kind: 'focus-ended', elapsedMs: 0, reason: 'manual' }), ready, 'ZER01'],
      [event({ kind: 'note-saved', hasText: false }), running, 'NME01'],
      [event({ kind: 'note-saved', hasText: true }), running, 'NTX01'],
      [event({ kind: 'break-started' }), { ...running, phase: 'break' }, 'BRK01'],
      [event({ kind: 'break-ended' }), ready, 'BRE01'],
      ...ASK_POOLS.map(pool => [event({ kind: 'encouragement-requested', category: pool }), ready, `${pool}01`] as [FeedbackEvent, FeedbackContext, string]),
    ]
    for (const [e, context, id] of cases) expect(reduce(e, context).frame.encouragement?.id).toBe(id)
  })

  it('treats 1 second, 5 minutes and 25 minutes alike for manual and elapsed endings', () => {
    for (const ms of [1000, 300_000, 1_500_000]) {
      const manual = reduce(event({ kind: 'focus-ended', elapsedMs: ms, reason: 'manual' }))
      const elapsed = reduce({ ...event({ kind: 'focus-ended', elapsedMs: ms, reason: 'elapsed' }), origin: 'expiry' })
      expect(manual.frame.encouragement?.id).toBe('END01')
      expect(manual.frame.encouragement).toEqual(elapsed.frame.encouragement)
    }
  })

  it('uses truthful zero/sub-second results and never invents time', () => {
    const zero = reduce(event({ kind: 'focus-ended', elapsedMs: 0, reason: 'manual' }))
    expect(zero.frame.status.text).toBe('已开始过这一段。')
    expect(zero.frame.encouragement?.pool).toBe('ZER')
    expect(reduce(event({ kind: 'focus-ended', elapsedMs: 1, reason: 'manual' })).frame.status.text).toBe('本段计时不到1秒。')
    expect(reduce(event({ kind: 'focus-ended', elapsedMs: 20_000, reason: 'manual' })).frame.status.text).toBe('本段计时20秒。')
    expect(reduce(event({ kind: 'focus-ended', elapsedMs: 0, reason: 'manual' }), { ...ready, participationSaved: false }).frame.encouragement).toBeNull()
    for (const ms of [-1, NaN, Infinity]) expect(reduce(event({ kind: 'focus-ended', elapsedMs: ms, reason: 'manual' })).frame.encouragement).toBeNull()
  })

  it.each(['saving', 'pending', 'memory-only', 'read-only'] as const)('never celebrates or claims saved while %s', persistence => {
    const result = reduce(event({ kind: 'note-saved', hasText: true }), { ...running, persistence })
    expect(result.frame.encouragement).toBeNull()
    expect(result.frame.status.text).not.toContain('已保存')
  })

  it('keeps a real error visible while allowing explicitly requested support', () => {
    const r = reduce(event({ kind: 'encouragement-requested' }), { ...running, persistence: 'pending' })
    expect(r.frame.status.id).toBe('pending')
    expect(r.frame.encouragement?.pool).toBe('ASKG')
    expect(r.announcement?.text).toContain('尚未保存')
    expect(r.announcement?.text).toContain(r.frame.encouragement!.text)
    const tick = reduce(event({ kind: 'reconcile' }, 'tick'), { ...running, persistence: 'pending' }, r.state)
    expect(tick.frame.encouragement).toEqual(r.frame.encouragement)
    expect(tick.announcement).toBeNull()
  })

  it('does not replay a stale ending or celebrate rest pauses', () => {
    expect(reduce(event({ kind: 'focus-ended', elapsedMs: 1000, reason: 'manual' }), paused).frame.encouragement).toBeNull()
    const breakPause = reduce(event({ kind: 'paused' }), { ...paused, phase: 'break' })
    expect(breakPause.frame.encouragement).toBeNull()
    expect(breakPause.frame.status.text).toBe('休息已暂停。')
  })
})

describe('rotation, silence and one-result-per-action', () => {
  it.each(ASK_POOLS)('cycles %s indefinitely in editorial order without adjacent repeats', pool => {
    let memory = createFeedbackMemory()
    const ids: string[] = []
    for (let i = 0; i < 42; i++) {
      const r = reduce(event({ kind: 'encouragement-requested', category: pool }, String(i)), ready, memory)
      memory = r.state; ids.push(r.frame.encouragement!.id)
    }
    const expected = [1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 8].map(i => `${pool}${String(i).padStart(2, '0')}`)
    expect(ids).toEqual([...expected, ...expected, ...expected])
  })

  it('defaults each new general request to ASKG, with no carried-over emotion category', () => {
    const tired = reduce(event({ kind: 'encouragement-requested', category: 'ASKT' }))
    expect(reduce(event({ kind: 'encouragement-requested' }, 'next'), ready, tired.state).frame.encouragement?.pool).toBe('ASKG')
  })

  it('avoids a similar semantic tag across pools', () => {
    const pausedResult = reduce(event({ kind: 'paused' }), paused)
    expect(pausedResult.frame.encouragement?.id).toBe('PAU01')
    const restEnd = reduce(event({ kind: 'break-ended' }, 'rest-end', 1000), ready, pausedResult.state)
    expect(restEnd.frame.encouragement?.id).toBe('BRE02')
  })

  it('falls back to accurate status when no eligible nonrepeating copy remains', () => {
    const memory: FeedbackMemory = { ...createFeedbackMemory(), lastPool: 'STA', lastTags: ['autonomy', 'rest', 'stored', 'possibility', 'care', 'return', 'small-step', 'patience', 'presence'] }
    const r = reduce(event({ kind: 'paused' }), paused, memory)
    expect(r.frame.status.id).toBe('UI26'); expect(r.frame.encouragement).toBeNull()
  })

  it('coalesces repeated pauses and one note interaction but preserves start/end responses', () => {
    const first = reduce(event({ kind: 'paused' }), paused)
    const repeated = reduce(event({ kind: 'paused' }, 'b', 29_999), paused, first.state)
    expect(repeated.frame.encouragement).toBeNull(); expect(repeated.frame.status.id).toBe('UI26')
    const later = reduce(event({ kind: 'paused' }, 'c', 60_000), paused, repeated.state)
    expect(later.frame.encouragement?.id).toBe('PAU02')
    const saved = reduce({ ...event({ kind: 'note-saved', hasText: true }), interactionId: 'note-1' }, running)
    const returned = reduce({ ...event({ kind: 'note-saved', hasText: true }, 'return', 60_000), interactionId: 'note-1' }, running, saved.state)
    expect(returned.frame.encouragement).toBeNull()
    const start = reduce(event({ kind: 'focus-started' }), running)
    expect(reduce(event({ kind: 'focus-ended', elapsedMs: 0, reason: 'manual' }, 'end', 1), ready, start.state).frame.encouragement?.pool).toBe('ZER')
  })

  it('treats a mark and a typed save as one noisy family', () => {
    const mark = reduce(event({ kind: 'note-saved', hasText: false }), running)
    const text = reduce(event({ kind: 'note-saved', hasText: true }, 'text', 1000), running, mark.state)
    expect(text.frame.status.id).toBe('UI33'); expect(text.frame.encouragement).toBeNull()
  })

  it('supports a configurable cooldown and active requests bypass that cooldown', () => {
    const first = reduce(event({ kind: 'paused' }), paused)
    expect(reduce(event({ kind: 'paused' }, 'b', 5), paused, first.state, { cooldownMs: 0 }).frame.encouragement).not.toBeNull()
    expect(reduce(event({ kind: 'encouragement-requested' }, 'ask', 1), paused, first.state).frame.encouragement?.pool).toBe('ASKG')
  })

  it('never automatically rotates on ticks, navigation or recovered/synced events', () => {
    const first = reduce(event({ kind: 'focus-started' }), running)
    const tick = reduce(event({ kind: 'reconcile' }, 'tick', 60_000), running, first.state)
    expect(tick.frame.encouragement).toEqual(first.frame.encouragement); expect(tick.announcement).toBeNull()
    for (const origin of ['restore', 'sync'] as const) {
      const r = reduce({ ...event({ kind: 'focus-started' }), origin }, running, first.state)
      expect(r.announcement).toBeNull()
      expect(r.frame.encouragement).toBeNull()
    }
    const recovered = reduce({ ...event({ kind: 'paused' }), origin: 'restore' }, paused)
    expect(recovered.frame.status.id).toBe('UI28'); expect(recovered.frame.encouragement).toBeNull()
  })

  it('deduplicates event delivery yet allows the same operation to succeed on retry', () => {
    const e = event({ kind: 'note-saved', hasText: true })
    const failed = reduce(e, { ...running, persistence: 'pending' })
    const saved = reduce(e, running, failed.state)
    expect(saved.frame.encouragement?.id).toBe('NTX01')
    const duplicate = reduce(e, running, saved.state)
    expect(duplicate.frame).toEqual(saved.frame); expect(duplicate.announcement).toBeNull()
    expect(duplicate.state.cursors).toEqual(saved.state.cursors)
  })

  it('can close a message and change state without replaying old feedback', () => {
    const first = reduce(event({ kind: 'encouragement-requested' }))
    const closed = reduce(event({ kind: 'dismissed' }, 'close'), ready, first.state)
    expect(closed.frame.encouragement).toBeNull()
    expect(reduce(event({ kind: 'reconcile' }, 'tick'), running, closed.state).frame.encouragement).toBeNull()
    const saving = reduce(event({ kind: 'reconcile' }), { ...ready, persistence: 'saving' })
    expect(reduce(event({ kind: 'reconcile' }, 'saved'), ready, saving.state).frame.status.text).not.toBe('正在保存。')
  })

  it('keeps a requested phrase through a remote pause and reports a failure without rereading the phrase', () => {
    const first = reduce(event({ kind: 'encouragement-requested' }), running)
    const sync = reduce({ ...event({ kind: 'paused' }, 'remote'), origin: 'sync' }, paused, first.state)
    expect(sync.frame.encouragement).toEqual(first.frame.encouragement)
    expect(sync.frame.companionState).toBe('focus-paused')
    expect(sync.announcement).toBeNull()
    const failed = reduce(event({ kind: 'reconcile' }, 'fail'), { ...paused, persistence: 'pending' }, sync.state)
    expect(failed.frame.encouragement).toEqual(first.frame.encouragement)
    expect(failed.announcement?.text).toBe(failed.frame.status.text)
  })

  it('announces a newly observed technical error once without rotating encouragement', () => {
    const first = reduce(event({ kind: 'focus-started' }), running)
    const context = { ...running, persistence: 'pending' as const }
    const failed = reduce(event({ kind: 'reconcile' }, 'background-result'), context, first.state)
    expect(failed.announcement?.priority).toBe('assertive')
    expect(failed.frame.encouragement).toBeNull()
    const repeated = reduce(event({ kind: 'reconcile' }, 'next-tick'), context, failed.state)
    expect(repeated.announcement).toBeNull()
    expect(repeated.state.cursors).toEqual(first.state.cursors)
  })

  it('retains functionality and requested support with node encouragement off', () => {
    const quiet = reduce(event({ kind: 'focus-ended', elapsedMs: 1000, reason: 'manual' }), ready, createFeedbackMemory(), { nodeEncouragement: false })
    expect(quiet.frame.status.text).toBe('本段计时1秒。'); expect(quiet.frame.encouragement).toBeNull()
    expect(reduce(event({ kind: 'encouragement-requested' }, 'ask'), ready, quiet.state, { nodeEncouragement: false }).frame.encouragement?.pool).toBe('ASKG')
  })
})
