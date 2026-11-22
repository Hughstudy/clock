import { describe, expect, it } from 'vitest'
import raw from '../data/encouragement.zh-CN.json'
import { feedbackCatalog } from '../data/encouragement'
import { ASK_POOLS, NODE_POOLS, createFeedbackMemory, parseFeedbackCatalog, transitionFeedback, type FeedbackContext, type FeedbackEvent } from './feedback'

const ready: FeedbackContext = { phase: 'focus', status: 'ready', persistence: 'saved', participationSaved: true }
const running: FeedbackContext = { ...ready, status: 'running' }
const paused: FeedbackContext = { ...ready, status: 'paused' }
const event = (details: Omit<FeedbackEvent, 'id' | 'atMs' | 'origin'> & Record<string, unknown>, id = 'a', atMs = 0): FeedbackEvent => ({ id, atMs, origin: 'user', ...details }) as FeedbackEvent
const reduce = (e: FeedbackEvent, c = ready, m = createFeedbackMemory(), options = {}) => transitionFeedback(m, e, c, feedbackCatalog, options)

describe('PRD copy resource integrity', () => {
  it('contains the exact pool coverage, candidate status and deep/light separation', () => {
    for (const pool of NODE_POOLS) expect(feedbackCatalog.entries.filter(e => e.pool === pool).length).toBeGreaterThanOrEqual(2)
    for (const pool of ASK_POOLS) expect(feedbackCatalog.entries.filter(e => e.pool === pool).length).toBeGreaterThanOrEqual(2)
    expect(feedbackCatalog.entries).toHaveLength(61)
    expect(feedbackCatalog.entries.every(e => e.reviewStatus === 'candidate')).toBe(true)
  })

  it('versions the companion’s spoken lines independently from automatic and welcome copy', () => {
    for (const entry of feedbackCatalog.entries) {
      if (entry.pool.startsWith('ASK')) {
        expect(entry.copyVersion).toBe('companion-voice-v3')
      } else expect(entry.copyVersion).toBe('companion-moments-v2')
    }
    expect(feedbackCatalog.welcomeNote.copyVersion).toBe('companion-moments-v2')
  })

  it.each(['id', 'facts', 'states', 'version', 'requested-version', 'markup', 'missing', 'deep', 'ui', 'error'] as const)('rejects damaged %s before use', kind => {
    const bad = structuredClone(raw)
    if (kind === 'id') bad.entries[1]!.id = bad.entries[0]!.id
    if (kind === 'facts') bad.entries[0]!.requiredFacts = ['guessedTired']
    if (kind === 'states') bad.entries[0]!.states = ['cry']
    if (kind === 'version') bad.entries[0]!.copyVersion = 'unknown'
    if (kind === 'requested-version') bad.entries.find(e => e.pool === 'ASKG')!.copyVersion = bad.copyVersion
    if (kind === 'markup') bad.entries[0]!.text = '<script>alert(1)</script>'
    if (kind === 'missing') bad.entries = bad.entries.filter(e => e.pool !== 'ASKT')
    if (kind === 'deep') bad.entries[0]!.level = 'deep'
    if (kind === 'ui') bad.interfaceCopy[0]!.id = bad.interfaceCopy[1]!.id
    if (kind === 'error') bad.errors[0]!.text = ' '
    expect(() => parseFeedbackCatalog(bad)).toThrow(/feedback catalog/)
  })
})

describe('truthful feedback eligibility', () => {
  it('selects only the appropriate pools from committed facts', () => {
    const cases: [FeedbackEvent, FeedbackContext, string | null][] = [
      [event({ kind: 'focus-started' }), running, 'STA'],
      [event({ kind: 'paused' }), paused, null],
      [event({ kind: 'resumed' }), running, null],
      [event({ kind: 'focus-ended', elapsedMs: 1000, reason: 'manual' }), ready, 'END'],
      [event({ kind: 'focus-ended', elapsedMs: 0, reason: 'manual' }), ready, 'ZER'],
      [event({ kind: 'note-saved', hasText: false }), running, null],
      [event({ kind: 'note-saved', hasText: true }), running, null],
      [event({ kind: 'break-started' }), { ...running, phase: 'break' }, 'BRK'],
      [event({ kind: 'break-ended' }), ready, null],
      ...ASK_POOLS.map(pool => [event({ kind: 'encouragement-requested', category: pool }), ready, pool] as [FeedbackEvent, FeedbackContext, string]),
    ]
    cases.push([event({ kind: 'ready-entered' }), { ...ready, returningReady: true }, 'RET'])
    for (const [e, context, pool] of cases) expect(reduce(e, context).frame.encouragement?.pool ?? null).toBe(pool)
  })

  it('treats 1 second, 5 minutes and 25 minutes alike for manual and elapsed endings', () => {
    for (const ms of [1000, 300_000, 1_500_000]) {
      const manual = reduce(event({ kind: 'focus-ended', elapsedMs: ms, reason: 'manual' }))
      const elapsed = reduce({ ...event({ kind: 'focus-ended', elapsedMs: ms, reason: 'elapsed' }), origin: 'expiry' })
      expect(manual.frame.encouragement?.pool).toBe('END')
      expect(manual.frame.encouragement).toEqual(elapsed.frame.encouragement)
    }
  })

  it('uses truthful zero/sub-second results and never invents time', () => {
    const zero = reduce(event({ kind: 'focus-ended', elapsedMs: 0, reason: 'manual' }))
    expect(zero.frame.status.text).toBe('本段计时0秒。')
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
  it.each([...ASK_POOLS, 'RET', 'STA', 'END', 'ZER', 'BRK'] as const)('draws reproducibly from %s with no adjacent repeats', pool => {
    const e: Omit<FeedbackEvent, 'id' | 'atMs' | 'origin'> & Record<string, unknown> = pool.startsWith('ASK') ? { kind: 'encouragement-requested', category: pool }
      : pool === 'RET' ? { kind: 'ready-entered' }
      : pool === 'STA' ? { kind: 'focus-started' }
      : pool === 'BRK' ? { kind: 'break-started' }
      : { kind: 'focus-ended', elapsedMs: pool === 'ZER' ? 0 : 1000, reason: 'manual' }
    const context = pool === 'BRK' ? { ...running, phase: 'break' as const }
      : pool === 'STA' ? running : { ...ready, returningReady: true }
    const count = feedbackCatalog.entries.filter(e => e.pool === pool).length
    const sequence = (seed: number) => {
      let memory = createFeedbackMemory(seed)
      const ids: string[] = []
      for (let i = 0; i < count * 3; i++) {
        const r = reduce(event(e, String(i), i * 30_000), context, memory)
        memory = r.state
        ids.push(r.frame.encouragement!.id)
      }
      return ids
    }
    const ids = sequence(1234)
    expect(new Set(ids).size).toBeGreaterThanOrEqual(Math.min(3, count))
    expect(ids.every(id => feedbackCatalog.entries.some(e => e.id === id && e.pool === pool))).toBe(true)
    expect(ids.every((id, i) => i === 0 || id !== ids[i - 1])).toBe(true)
    expect(sequence(1234)).toEqual(ids)
    expect(sequence(987654321)).not.toEqual(ids)
  })

  it('can repeat a phrase before exhausting the requested pool', () => {
    let memory = createFeedbackMemory(1234)
    const ids: string[] = []
    const count = feedbackCatalog.entries.filter(e => e.pool === 'ASKG').length
    for (let i = 0; i < count; i++) {
      const result = reduce(event({ kind: 'encouragement-requested' }, String(i)), ready, memory)
      memory = result.state
      ids.push(result.frame.encouragement!.id)
    }
    expect(new Set(ids).size).toBeLessThan(count)
  })

  it('defaults each new general request to ASKG, with no carried-over emotion category', () => {
    const tired = reduce(event({ kind: 'encouragement-requested', category: 'ASKT' }))
    expect(reduce(event({ kind: 'encouragement-requested' }, 'next'), ready, tired.state).frame.encouragement?.pool).toBe('ASKG')
  })

  it('shares the automatic cooldown across entry, focus and rest without postponing any phrase', () => {
    const entry = reduce(event({ kind: 'ready-entered' }), { ...ready, returningReady: true })
    const start = reduce(event({ kind: 'focus-started' }, 'start', 1000), running, entry.state)
    expect(start.frame.encouragement).toBeNull()
    expect(start.state.lastAutomaticAt).toBe(0)
    expect(start.state.randomState).toBe(entry.state.randomState)
    const end = reduce(event({ kind: 'focus-ended', elapsedMs: 29_000, reason: 'manual' }, 'end', 30_000), ready, start.state)
    expect(end.frame.encouragement?.pool).toBe('END')
    const rest = reduce(event({ kind: 'break-started' }, 'rest', 30_001), { ...running, phase: 'break' }, end.state)
    expect(rest.frame.encouragement).toBeNull()
    expect(reduce(event({ kind: 'reconcile' }, 'tick', 60_001), { ...running, phase: 'break' }, rest.state).frame.encouragement).toBeNull()
    expect(reduce(event({ kind: 'encouragement-requested' }, 'ask', 30_002), ready, rest.state).frame.encouragement?.pool).toBe('ASKG')
  })

  it('keeps pause, resume, notes and rest end factual and quiet', () => {
    for (const e of [event({ kind: 'paused' }), event({ kind: 'resumed' }), event({ kind: 'note-saved', hasText: false }), event({ kind: 'note-saved', hasText: true }), event({ kind: 'break-ended' })]) {
      const r = reduce(e, e.kind === 'paused' ? paused : e.kind === 'break-ended' ? ready : running)
      expect(r.frame.encouragement).toBeNull()
      expect(r.announcement?.text).toBe(r.frame.status.text)
      expect(r.state.lastAutomaticAt).toBeNull()
    }
  })

  it('requires actual history and ready state for an entry greeting', () => {
    const e = event({ kind: 'ready-entered' })
    expect(reduce(e).frame.encouragement).toBeNull()
    expect(reduce(e, { ...running, returningReady: true }).frame.encouragement).toBeNull()
    expect(reduce(e, { ...ready, returningReady: true, persistence: 'pending' }).frame.encouragement).toBeNull()
  })

  it('supports a configurable cooldown', () => {
    const first = reduce(event({ kind: 'focus-started' }), running)
    expect(reduce(event({ kind: 'focus-ended', elapsedMs: 1, reason: 'manual' }, 'end', 1), ready, first.state, { cooldownMs: 0 }).frame.encouragement?.pool).toBe('END')
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
    expect(saved.frame.encouragement).toBeNull()
    expect(saved.frame.status.id).toBe('UI33')
    const duplicate = reduce(e, running, saved.state)
    expect(duplicate.frame).toEqual(saved.frame); expect(duplicate.announcement).toBeNull()
    expect(duplicate.state.randomState).toEqual(saved.state.randomState)
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
    expect(repeated.state.randomState).toEqual(first.state.randomState)
  })

  it('retains functionality and requested support with node encouragement off', () => {
    const quiet = reduce(event({ kind: 'focus-ended', elapsedMs: 1000, reason: 'manual' }), ready, createFeedbackMemory(), { nodeEncouragement: false })
    expect(quiet.frame.status.text).toBe('本段计时1秒。'); expect(quiet.frame.encouragement).toBeNull()
    expect(reduce(event({ kind: 'encouragement-requested' }, 'ask'), ready, quiet.state, { nodeEncouragement: false }).frame.encouragement?.pool).toBe('ASKG')
  })
})
