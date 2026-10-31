import { describe, expect, it } from 'vitest'
import raw from '../data/encouragement.zh-CN.json'
import { feedbackCatalog } from '../data/encouragement'
import { ASK_POOLS, NODE_POOLS, createEncouragementBookmark, createFeedbackMemory, parseFeedbackCatalog, transitionFeedback, type FeedbackContext, type FeedbackEvent, type FeedbackMemory } from './feedback'

const ready: FeedbackContext = { phase: 'focus', status: 'ready', persistence: 'saved', initialized: true, participationSaved: true }
const running: FeedbackContext = { ...ready, status: 'running' }
const paused: FeedbackContext = { ...ready, status: 'paused' }
const event = (details: Omit<FeedbackEvent, 'id' | 'atMs' | 'origin'> & Record<string, unknown>, id = 'a', atMs = 0): FeedbackEvent => ({ id, atMs, origin: 'user', ...details }) as FeedbackEvent
const reduce = (e: FeedbackEvent, c = ready, m = createFeedbackMemory(), options = {}) => transitionFeedback(m, e, c, feedbackCatalog, options)

describe('PRD copy resource integrity', () => {
  it('contains the exact pool coverage, candidate status and deep/light separation', () => {
    expect(feedbackCatalog.entries).toHaveLength(136)
    for (const pool of NODE_POOLS) expect(feedbackCatalog.entries.filter(e => e.pool === pool)).toHaveLength(5)
    for (const pool of ASK_POOLS) expect(feedbackCatalog.entries.filter(e => e.pool === pool)).toHaveLength(14)
    expect(feedbackCatalog.entries.filter(e => e.level === 'deep')).toHaveLength(24)
    expect(feedbackCatalog.entries.every(e => e.collectible && e.reviewStatus === 'candidate')).toBe(true)
    expect(feedbackCatalog.interfaceCopy).toHaveLength(44)
    expect(feedbackCatalog.errors).toHaveLength(14)
  })

  it.each(['id', 'facts', 'states', 'version', 'markup', 'missing', 'deep', 'ui', 'error'] as const)('rejects damaged %s before use', kind => {
    const bad = structuredClone(raw)
    if (kind === 'id') bad.entries[1]!.id = bad.entries[0]!.id
    if (kind === 'facts') bad.entries[0]!.requiredFacts = ['guessedTired']
    if (kind === 'states') bad.entries[0]!.states = ['cry']
    if (kind === 'version') bad.entries[0]!.copyVersion = 'unknown'
    if (kind === 'markup') bad.entries[0]!.text = '<script>alert(1)</script>'
    if (kind === 'missing') bad.entries.pop()
    if (kind === 'deep') bad.entries[0]!.level = 'deep'
    if (kind === 'ui') bad.interfaceCopy[0]!.id = 'UI02'
    if (kind === 'error') bad.errors.pop()
    expect(() => parseFeedbackCatalog(bad)).toThrow(/feedback catalog/)
  })
})

describe('truthful feedback eligibility', () => {
  it('starts at each pool’s first candidate with the facts it needs', () => {
    const cases: [FeedbackEvent, FeedbackContext, string][] = [
      [event({ kind: 'welcome', firstVisit: true }), ready, 'WEL01'],
      [event({ kind: 'welcome', firstVisit: false }), ready, 'RET01'],
      [event({ kind: 'focus-started' }), running, 'STA01'],
      [event({ kind: 'paused' }), paused, 'PAU01'],
      [event({ kind: 'resumed' }), running, 'RES01'],
      [event({ kind: 'focus-ended', elapsedMs: 1000, reason: 'manual' }), ready, 'END01'],
      [event({ kind: 'focus-ended', elapsedMs: 0, reason: 'manual' }), ready, 'ZER01'],
      [event({ kind: 'note-saved', hasText: false }), running, 'NME01'],
      [event({ kind: 'note-saved', hasText: true }), running, 'NTX01'],
      [event({ kind: 'returned' }), paused, 'BCK01'],
      [event({ kind: 'break-started' }), { ...running, phase: 'break' }, 'BRK01'],
      [event({ kind: 'break-ended' }), ready, 'BRE01'],
      [event({ kind: 'records-viewed' }), { ...ready, history: 'nonempty' }, 'REV01'],
      [event({ kind: 'records-viewed' }), { ...ready, history: 'empty' }, 'EMP01'],
      [event({ kind: 'memento-viewed' }), { ...ready, mementoSaved: true }, 'MEM01'],
      [event({ kind: 'new-content', explicitlyViewed: false }), { ...ready, rewardApproved: true, rewardContentReady: true, rewardSaved: true }, 'NEW01'],
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

  it.each(['saving', 'pending', 'memory-only', 'read-only', 'unavailable', 'unknown'] as const)('never celebrates or claims saved while %s', persistence => {
    const result = reduce(event({ kind: 'note-saved', hasText: true }), { ...running, persistence })
    expect(result.frame.encouragement).toBeNull()
    expect(result.frame.status.text).not.toContain('已保存')
  })

  it('keeps a real error visible while allowing explicitly requested support', () => {
    const r = reduce(event({ kind: 'encouragement-requested' }), { ...running, persistence: 'pending', error: 'ERR01' })
    expect(r.frame.status.id).toBe('ERR01')
    expect(r.frame.encouragement?.pool).toBe('ASKG')
    expect(r.announcement?.text).toContain('还没保存成功')
    expect(r.announcement?.text).toContain(r.frame.encouragement!.text)
    const tick = reduce(event({ kind: 'reconcile' }, 'tick'), { ...running, persistence: 'pending', error: 'ERR01' }, r.state)
    expect(tick.frame.encouragement).toEqual(r.frame.encouragement)
    expect(tick.announcement).toBeNull()
  })

  it('does not invent retained drafts, successful rollback or duration limits', () => {
    const e = event({ kind: 'reconcile' })
    expect(reduce(e, { ...ready, error: 'ERR04' }).frame.status.text).toContain('无法确认草稿')
    expect(reduce(e, { ...ready, error: 'ERR04', draftRetained: true }).frame.status.text).toContain('文字暂留')
    expect(reduce(e, { ...ready, error: 'ERR09' }).frame.status.text).toContain('无法确认原有数据')
    expect(reduce(e, { ...ready, error: 'ERR09', originalDataUnchanged: true }).frame.status.text).toContain('保持不变')
    expect(reduce(e, { ...ready, error: 'ERR11', focusMinuteBounds: [1, 60] }).frame.status.text).toContain('1到60')
    expect(reduce(e, { ...ready, error: 'ERR11' }).frame.status.text).not.toContain('120')
  })

  it('distinguishes empty history, a filtered empty day and unreadable history', () => {
    const e = event({ kind: 'records-viewed' })
    expect(reduce(e, { ...ready, history: 'empty' }).frame.encouragement?.pool).toBe('EMP')
    const filtered = reduce(e, { ...ready, history: 'filtered-empty' })
    expect(filtered.frame.status.id).toBe('UI37'); expect(filtered.frame.encouragement).toBeNull()
    const unreadable = reduce(e, { ...ready, history: 'unknown', error: 'ERR02' })
    expect(unreadable.frame.status.id).toBe('ERR02'); expect(unreadable.frame.encouragement).toBeNull()
    expect(reduce(e, { ...ready, history: 'unknown' }).frame.status.kind).toBe('error')
  })

  it('only enables new content after review, production, saving and a quiet moment', () => {
    const e = event({ kind: 'new-content', explicitlyViewed: false })
    const valid = { ...ready, rewardApproved: true, rewardContentReady: true, rewardSaved: true }
    for (const fact of ['rewardApproved', 'rewardContentReady', 'rewardSaved'] as const) expect(reduce(e, { ...valid, [fact]: false }).frame.encouragement).toBeNull()
    expect(reduce(e, { ...valid, status: 'running' }).frame.encouragement).toBeNull()
    expect(reduce(event({ kind: 'new-content', explicitlyViewed: true }), { ...valid, status: 'running' }).frame.encouragement?.pool).toBe('NEW')
  })

  it('does not welcome an active session, replay a stale ending or celebrate rest pauses', () => {
    expect(reduce(event({ kind: 'welcome', firstVisit: false }), running).frame.encouragement).toBeNull()
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
    expect(reduce({ ...event({ kind: 'encouragement-requested', category: 'ASKT' }), origin: 'navigation' }).frame.encouragement).toBeNull()
  })

  it('avoids a similar semantic tag across pools', () => {
    const pausedResult = reduce(event({ kind: 'paused' }), paused)
    expect(pausedResult.frame.encouragement?.id).toBe('PAU01')
    const restEnd = reduce(event({ kind: 'break-ended' }, 'rest-end', 1000), ready, pausedResult.state)
    expect(restEnd.frame.encouragement?.id).toBe('BRE02')
  })

  it('falls back to accurate status when no eligible nonrepeating copy remains', () => {
    const memory: FeedbackMemory = { ...createFeedbackMemory(), lastPool: 'RET', lastTags: ['autonomy', 'rest', 'stored', 'possibility', 'care', 'return', 'small-step', 'patience', 'presence'] }
    const r = reduce(event({ kind: 'paused' }), paused, memory)
    expect(r.frame.status.id).toBe('UI26'); expect(r.frame.encouragement).toBeNull()
  })

  it('coalesces repeated pauses and save/return interactions but preserves start/end responses', () => {
    const first = reduce(event({ kind: 'paused' }), paused)
    const repeated = reduce(event({ kind: 'paused' }, 'b', 29_999), paused, first.state)
    expect(repeated.frame.encouragement).toBeNull(); expect(repeated.frame.status.id).toBe('UI26')
    const later = reduce(event({ kind: 'paused' }, 'c', 60_000), paused, repeated.state)
    expect(later.frame.encouragement?.id).toBe('PAU02')
    const saved = reduce({ ...event({ kind: 'note-saved', hasText: true }), interactionId: 'note-1' }, running)
    const returned = reduce({ ...event({ kind: 'returned' }, 'return', 60_000), interactionId: 'note-1' }, running, saved.state)
    expect(returned.frame.encouragement).toBeNull()
    const start = reduce(event({ kind: 'focus-started' }), running)
    expect(reduce(event({ kind: 'focus-ended', elapsedMs: 0, reason: 'manual' }, 'end', 1), ready, start.state).frame.encouragement?.pool).toBe('ZER')
  })

  it('treats mark, typed save and return as one noisy family', () => {
    const mark = reduce(event({ kind: 'note-saved', hasText: false }), running)
    const text = reduce(event({ kind: 'note-saved', hasText: true }, 'text', 1000), running, mark.state)
    expect(text.frame.status.id).toBe('UI33'); expect(text.frame.encouragement).toBeNull()
    expect(reduce(event({ kind: 'returned' }, 'return', 2000), running, text.state).frame.encouragement).toBeNull()
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
    for (const origin of ['restore', 'sync', 'navigation'] as const) {
      const r = reduce({ ...event({ kind: 'focus-started' }), origin }, running, first.state)
      expect(r.announcement).toBeNull()
      if (origin !== 'navigation') expect(r.frame.encouragement).toBeNull()
    }
    const recovered = reduce({ ...event({ kind: 'welcome', firstVisit: false }), origin: 'restore' }, paused)
    expect(recovered.frame.status.id).toBe('UI28'); expect(recovered.frame.encouragement).toBeNull()
  })

  it('keeps static page copy stable across new view events and never announces it', () => {
    const first = reduce(event({ kind: 'records-viewed' }), { ...ready, history: 'nonempty' })
    const second = reduce(event({ kind: 'records-viewed' }, 'date-changed'), { ...ready, history: 'nonempty' }, first.state)
    expect(second.frame.encouragement).toEqual(first.frame.encouragement)
    expect(first.announcement).toBeNull(); expect(second.announcement).toBeNull()
  })

  it('deduplicates event delivery yet allows the same operation to succeed on retry', () => {
    const e = event({ kind: 'note-saved', hasText: true })
    const failed = reduce(e, { ...running, persistence: 'pending', error: 'ERR04', draftRetained: true })
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
    const context = { ...running, persistence: 'pending' as const, error: 'ERR01' as const }
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

  it('prepares a stable, versioned bookmark snapshot without claiming persistence', () => {
    const copy = feedbackCatalog.entries.find(c => c.id === 'ASKT09')!
    expect(createEncouragementBookmark(copy)).toEqual({ copyId: 'ASKT09', text: copy.text, copyVersion: 'prd-v3-r7' })
    expect(createEncouragementBookmark(copy)).not.toHaveProperty('saved')
  })
})
