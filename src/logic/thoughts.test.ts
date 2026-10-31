import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { applyAction, nextFocusMinutes, reconcile, type ActionContext, type AppAction } from './app'
import { createSnapshot, decodeSnapshot, encodeSnapshot, hasMissingRecords, mergeSnapshots } from './snapshot'
import type { AppSnapshot, ThoughtDraft } from './types'
import { datePendingDeletion } from './thoughts'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 29, 9, 0, 0)
const utcKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const ctx = (now: number): ActionContext => ({ now, dateKeyOf: utcKey })
const step = (s: AppSnapshot, now: number, action: AppAction) => applyAction(s, action, ctx(now), spec)
const run = (s: AppSnapshot, steps: [number, AppAction][]) => steps.reduce((acc, [now, a]) => step(acc, now, a).snapshot, s)
const tz = 'UTC'
const draft = (text: string, thoughtId: string | null = null): ThoughtDraft => ({
  id: 'editor', text, thoughtId, baseRev: thoughtId ? 1 : null, sessionId: null,
  createdAt: T0, dateKey: utcKey(T0), timeZone: tz,
})
const write = (value: ThoughtDraft): AppAction => ({ type: 'writeDraft', draft: value, expectedStamp: null, stamp: 'draft1' })

describe('thought capture', () => {
  it('saves an empty marker then text during a running session without touching the timer, and links it to the ended record', () => {
    let s = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'f1', timeZone: tz }]])
    const before = s.timer
    const marked = step(s, T0 + MIN, { type: 'markThought', thoughtId: 'n1', timeZone: tz })
    expect(marked.thought).toEqual({ id: 'n1', change: 'marked' })
    s = marked.snapshot
    expect(s.timer).toEqual(before)
    expect(s.thoughts).toMatchObject([{ id: 'n1', text: '', sessionId: 'f1', status: 'open', rev: 1, deletedAt: null }])

    const texted = step(s, T0 + 2 * MIN, { type: 'saveThoughtText', thoughtId: 'n2', text: '  Pick up the parcel tonight ', timeZone: tz })
    expect(texted.thought).toEqual({ id: 'n2', change: 'text' })
    s = run(texted.snapshot, [[T0 + 3 * MIN, { type: 'end', sessionId: 'f1' }]])
    expect(s.timer.session).toBeNull()
    expect(s.records).toMatchObject([{ sessionId: 'f1', elapsedMs: 3 * MIN }])
    expect(s.thoughts.filter((t) => t.sessionId === 'f1').map((t) => t.text)).toEqual(['', 'Pick up the parcel tonight'])
  })

  it('is idempotent for a repeated delivery of the same marker', () => {
    const s = run(createSnapshot(spec), [[T0, { type: 'markThought', thoughtId: 'n1', timeZone: tz }]])
    const again = step(s, T0 + 10, { type: 'markThought', thoughtId: 'n1', timeZone: tz })
    expect(again.changed).toBe(false)
    expect(again.snapshot.thoughts).toHaveLength(1)
  })

  it('keeps thoughts outside focus standalone and adds no focus time', () => {
    let s = run(createSnapshot(spec), [[T0, { type: 'startBreak', sessionId: 'b1', timeZone: tz }]])
    s = run(s, [[T0 + MIN, { type: 'markThought', thoughtId: 'n1', timeZone: tz }]])
    expect(s.thoughts[0]).toMatchObject({ sessionId: null, dateKey: utcKey(T0) })
    expect(s.records).toEqual([])
    expect(s.participations).toEqual([])
  })

  it('adds text to an existing marker, clears the matching draft in the same change, and rejects edits to deleted thoughts', () => {
    let s = run(createSnapshot(spec), [
      [T0, { type: 'markThought', thoughtId: 'n1', timeZone: tz }],
      [T0 + 1, write(draft('half typed', 'n1'))],
    ])
    expect(s.thoughtDraft).toEqual(draft('half typed', 'n1'))
    s = run(s, [[T0 + 2, { type: 'saveThoughtText', thoughtId: 'n1', text: 'half typed, now done', timeZone: tz,
      draft: s.thoughtDraft!, expectedStamp: 'draft1', stamp: 'saved' }]])
    expect(s.thoughts[0]).toMatchObject({ text: 'half typed, now done', rev: 2 })
    expect(s.thoughtDraft).toBeNull()

    s = run(s, [[T0 + 3, { type: 'deleteThought', thoughtId: 'n1' }]])
    const edit = step(s, T0 + 4, { type: 'saveThoughtText', thoughtId: 'n1', text: 'again', timeZone: tz })
    expect(edit.thought).toEqual({ id: 'n1', change: 'rejected' })
    expect(edit.changed).toBe(false)
  })

  it('retains input and its deleted target until the user explicitly saves a new thought', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'markThought', thoughtId: 'n1', timeZone: tz }],
      [T0 + 1, write(draft('keep me', 'n1'))],
      [T0 + 2, { type: 'deleteThought', thoughtId: 'n1' }],
    ])
    expect(s.thoughtDraft).toEqual(draft('keep me', 'n1'))
    const again = step(s, T0 + 3, { type: 'saveThoughtText', thoughtId: 'n1', text: 'keep me',
      timeZone: tz, draft: s.thoughtDraft!, expectedStamp: 'draft1', stamp: 'next' })
    expect(again.thought?.change).toBe('rejected')
    expect(again.snapshot.thoughtDraft).toEqual(s.thoughtDraft)
  })

  it('puts away, reopens, deletes and restores within the undo period, then clears deleted text', () => {
    let s = run(createSnapshot(spec), [
      [T0, { type: 'saveThoughtText', thoughtId: 'n1', text: 'call back', timeZone: tz }],
      [T0 + 1, { type: 'putAwayThought', thoughtId: 'n1' }],
    ])
    expect(s.thoughts[0]).toMatchObject({ status: 'putAway', rev: 2 })
    s = run(s, [[T0 + 2, { type: 'reopenThought', thoughtId: 'n1' }], [T0 + 3, { type: 'deleteThought', thoughtId: 'n1' }]])
    expect(s.thoughts[0]).toMatchObject({ deletedAt: T0 + 3, text: 'call back', rev: 4 })
    const restored = step(s, T0 + 4, { type: 'restoreThought', thoughtId: 'n1' })
    expect(restored.thought).toEqual({ id: 'n1', change: 'restored' })
    expect(restored.snapshot.thoughts[0]).toMatchObject({ deletedAt: null, text: 'call back', rev: 5 })

    s = run(restored.snapshot, [[T0 + 5, { type: 'deleteThought', thoughtId: 'n1' }]])
    const late = T0 + 5 + spec.thoughts.undoPeriodMs
    const expired = step(s, late, { type: 'restoreThought', thoughtId: 'n1' })
    expect(expired.thought).toEqual({ id: 'n1', change: 'rejected' })
    expect(expired.snapshot.thoughts[0]).toMatchObject({ text: '', deletedAt: T0 + 5 })
    expect(expired.changed).toBe(true)
  })
})

describe('thought synchronization', () => {
  const base = () => run(createSnapshot(spec), [[T0, { type: 'saveThoughtText', thoughtId: 'n1', text: 'one', timeZone: tz }]])

  it('lets a deletion win over a stale edit at the same revision, and a stale tab cannot resurrect it', () => {
    const deleted = { ...run(base(), [[T0 + 1, { type: 'deleteThought', thoughtId: 'n1' }]]), revision: 3, writer: 'a' }
    const edited = { ...run(base(), [[T0 + 1, { type: 'saveThoughtText', thoughtId: 'n1', text: 'two', timeZone: tz }]]), revision: 4, writer: 'b' }
    const merged = mergeSnapshots(deleted, edited)
    expect(merged.thoughts[0]).toMatchObject({ deletedAt: T0 + 1 })
    expect(mergeSnapshots(edited, deleted).thoughts).toEqual(merged.thoughts)
    expect(hasMissingRecords(edited, deleted)).toBe(true)
    expect(hasMissingRecords(merged, edited)).toBe(false)
    // The stale tab's next edit runs on the merged state and is rejected.
    expect(step(merged, T0 + 2, { type: 'saveThoughtText', thoughtId: 'n1', text: 'three', timeZone: tz }).thought?.change).toBe('rejected')
  })

  it('unions thoughts captured in different tabs and never merges across generations', () => {
    const a = { ...run(base(), [[T0 + 1, { type: 'markThought', thoughtId: 'a1', timeZone: tz }]]), revision: 5, writer: 'a' }
    const b = { ...run(base(), [[T0 + 2, { type: 'markThought', thoughtId: 'b1', timeZone: tz }]]), revision: 6, writer: 'b' }
    expect(mergeSnapshots(a, b).thoughts.map((t) => t.id)).toEqual(['n1', 'a1', 'b1'])
    const cleared = { ...createSnapshot(spec), datasetGeneration: 1 }
    expect(mergeSnapshots(a, cleared)).toEqual(cleared)
    expect(hasMissingRecords(cleared, a)).toBe(false)
  })

  it('round-trips thoughts and drafts, and reports unreadable entries without dropping the rest', () => {
    const s = run(base(), [[T0 + 1, write(draft('draft'))]])
    expect(decodeSnapshot(encodeSnapshot(s), spec, { timeZone: tz })).toEqual({ kind: 'ok', snapshot: s, issues: [] })
    const broken = decodeSnapshot(JSON.stringify({ ...s, thoughts: [...s.thoughts, { id: 'x', rev: 0 }] }), spec, { timeZone: tz })
    if (broken.kind !== 'ok') throw Error(broken.kind)
    expect(broken.snapshot.thoughts).toEqual(s.thoughts)
    expect(broken.issues).toEqual(['thoughts (1 unreadable)'])
  })
})

describe('v5 interaction boundaries', () => {
  it('BD04 only edits the explicitly chosen A after B, rejects blank new text and counts Unicode code points', () => {
    const base = run(createSnapshot(spec), ['a','b'].map(id => [T0, { type: 'markThought', thoughtId: id, timeZone: tz }]))
    const commit = (s: AppSnapshot, id: string, text: string, editing: ThoughtDraft) => step(s, T0,
      { type: 'saveThoughtText', thoughtId: id, text, draft: editing, timeZone: tz, expectedStamp: s.draftStamp, stamp: 'done' })
    let s = commit(base, 'a', '📦'.repeat(500), draft('', 'a')).snapshot
    expect(s.thoughts.map(t => t.text)).toEqual(['📦'.repeat(500), ''])
    expect(commit(s, 'c', '   ', draft('   ')).changed).toBe(false)
    expect(commit(s, 'c', '📦'.repeat(501), draft('')).changed).toBe(false)
    s = commit(s, 'a', ' ', { ...draft('', 'a'), baseRev: 2 }).snapshot
    expect(s.thoughts[0]).toMatchObject({ id:'a', text:'', rev:3 })
  })
  it('BD05 preserves first input date and original focus owner across midnight, expiry, new session and reopening', () => {
    const midnight = Date.UTC(2026,9,31)
    const opened = { ...draft('晚上取快递'), sessionId: 'A', createdAt: midnight-1000, dateKey: '2026-10-30' }
    const s = run(createSnapshot(spec), [
      [midnight-MIN, {type:'start',sessionId:'A',timeZone:tz,durationMinutes:1}],
      [midnight-1000,write(opened)],
      [midnight+1, {type:'startFocus',sessionId:'B',timeZone:tz}],
    ])
    const read = decodeSnapshot(encodeSnapshot(s), spec, {timeZone:tz})
    if (read.kind !== 'ok') throw Error(read.kind)
    const submit: AppAction = {type:'saveThoughtText',thoughtId:opened.id,text:opened.text,timeZone:tz,draft:opened,expectedStamp:'draft1',stamp:'saved'}
    const noted = step(read.snapshot,midnight+1000,submit).snapshot
    expect(noted.thoughts).toMatchObject([{sessionId:'A',dateKey:'2026-10-30',createdAt:midnight-1000}])
    expect(step(noted,midnight+2000,submit).snapshot.thoughts).toEqual(noted.thoughts)
  })
  it('BD06 checks thought version, slot version, generation and exact 10 minute delete undo window', () => {
    const base = run(createSnapshot(spec),[[T0,{type:'markThought',thoughtId:'a',timeZone:tz}], [T0,write(draft('local','a'))]])
    const remote = step(base,T0+1,{type:'saveThoughtText',thoughtId:'a',text:'remote',timeZone:tz}).snapshot
    expect(step(remote,T0+2,{type:'saveThoughtText',thoughtId:'a',text:'stale',timeZone:tz,draft:draft('stale','a')}).thought?.change).toBe('rejected')
    expect(step(remote,T0+2,write(draft('stale'))).draftConflict).toBe(true)
    expect(step({...remote,datasetGeneration:1},T0+2,{...write(draft('stale')),generation:0}).changed).toBe(false)
    const deleted = step(remote,T0+3,{type:'deleteThought',thoughtId:'a',expectedRev:2}).snapshot
    const undo:AppAction = {type:'restoreThought',thoughtId:'a',expectedRev:3}
    expect(step(deleted,T0+3+599_000,undo).thought?.change).toBe('restored')
    expect(step(deleted,T0+3+600_000,undo).thought?.change).toBe('rejected')
    const lateWrite = T0 + 900_000
    const pending = deleted.thoughts[0]!
    const accepted = datePendingDeletion(pending, remote.thoughts[0], pending, lateWrite)!
    expect(accepted).toMatchObject({ deletedAt: lateWrite, text: 'remote', rev: 3 })
    expect(datePendingDeletion(accepted, accepted, accepted, lateWrite+1)).toBeNull()
    expect(step({ ...deleted, thoughts: [accepted] }, lateWrite+599_000, undo).thought?.change).toBe('restored')
  })
  it('migrates v6 ownerless drafts as independent even with active focus, and protects unknown old text dates', () => {
    const running = step(createSnapshot(spec),T0,{type:'start',sessionId:'s',timeZone:tz}).snapshot
    const decoded = decodeSnapshot(JSON.stringify({...running,version:6,thoughtDraft:{thoughtId:null,text:'notes'}}),spec,{timeZone:tz})
    if(decoded.kind!=='ok') throw Error(decoded.kind)
    expect(decoded.issues).toEqual([])
    expect(decoded.snapshot.thoughtDraft).toMatchObject({sessionId:null,createdAt:null,dateKey:null,text:'notes'})
  })
})

describe('session step and one-off focus length', () => {
  it('captures an optional step at start and keeps it on manual and deadline endings', () => {
    let s = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'f1', timeZone: tz, step: '  outline   the intro ' }]])
    expect(s.timer.session?.step).toBe('outline the intro')
    s = run(s, [[T0 + MIN, { type: 'end', sessionId: 'f1' }], [T0 + MIN, { type: 'skipBreak' }]])
    expect(s.records[0]).toMatchObject({ step: 'outline the intro', elapsedMs: MIN })

    s = run(s, [[T0 + 2 * MIN, { type: 'start', sessionId: 'f2', timeZone: tz, step: '   ' }]])
    expect(s.timer.session?.step).toBeNull()
    s = reconcile(s, ctx(T0 + 27 * MIN), spec).snapshot
    expect(s.records[1]).toMatchObject({ sessionId: 'f2', step: null, endReason: 'deadline' })
  })

  it('remembers an explicit one-off length without changing the configured default', () => {
    let s = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'f1', timeZone: tz, durationMinutes: 15 }]])
    expect(s.settings.durationsMinutes.focus).toBe(25)
    expect(s.lastFocusMinutes).toBe(15)
    s = run(s, [[T0 + MIN, { type: 'end', sessionId: 'f1' }], [T0 + MIN, { type: 'skipBreak' }]])
    expect(nextFocusMinutes(s, spec)).toBe(15)
    s = run(s, [[T0 + 2 * MIN, { type: 'start', sessionId: 'f2', timeZone: tz }]])
    expect(s.timer.session?.durationMs).toBe(15 * MIN)
  })

  it('lets a new default supersede the remembered length and rejects invalid lengths', () => {
    let s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'f1', timeZone: tz, durationMinutes: 5 }],
      [T0, { type: 'end', sessionId: 'f1' }],
      [T0, { type: 'updateSettings', patch: { durationsMinutes: { focus: 30 } } }],
    ])
    expect(s.lastFocusMinutes).toBeNull()
    expect(nextFocusMinutes(s, spec)).toBe(30)
    s = run(s, [[T0, { type: 'updateSettings', patch: { soundEnabled: false } }]])
    const rejected = step({ ...s, timer: { ...s.timer, phase: 'focus' } }, T0, { type: 'start', sessionId: 'f2', timeZone: tz, durationMinutes: 500 })
    expect(rejected.changed).toBe(false)
  })

  it('records eight running, three paused and two running minutes as ten minutes', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'f1', timeZone: tz }],
      [T0 + 8 * MIN, { type: 'pause', sessionId: 'f1' }],
      [T0 + 11 * MIN, { type: 'resume', sessionId: 'f1' }],
      [T0 + 13 * MIN, { type: 'end', sessionId: 'f1' }],
    ])
    expect(s.records[0]?.elapsedMs).toBe(10 * MIN)
  })
})
