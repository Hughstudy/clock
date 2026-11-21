import { describe, expect, it } from 'vitest'
import { readBook, preferredPage } from './book-data'
import type { RecordView } from '../useViews'
import type { RestMemory, SceneId, Thought } from '../../logic/types'

function focus(id: string, sceneId: SceneId | null, saved = true): RecordView {
  return {
    sessionId: id,
    dateKey: '2026-11-02',
    startedAt: 0,
    endedAt: 60_000,
    elapsedMs: 60_000,
    targetMs: 60_000,
    endReason: 'manual',
    source: 'native',
    step: null,
    saved,
    sceneProgress: 1,
    thoughts: [],
    timeLabel: '00:00–00:01',
    ...(sceneId && { scene: { sceneId, ordinal: 1, selectionVersion: 2 } }),
  }
}
function rest(sessionId: string, dateKey: string | null, endedAt = 90_000): RestMemory {
  return { sessionId, dateKey, endedAt, elapsedMs: 30_000, phase: null, endReason: null, sceneId: 'R2' }
}
function book(records: RecordView[] = [], rests: RestMemory[] = [], thoughts: Thought[] = []) {
  return readBook({
    recordBySession: new Map(records.map((r) => [r.sessionId, r])),
    restMemories: rests,
    thoughtDays: [{ dateKey: '2026-11-02', entries: thoughts.map((thought) => ({ kind: 'thought', thought })) }],
    dayHeading: (key) => key,
    clockTime: () => '00:01',
  })
}

describe('book projection from saved views', () => {
  it('indexes only confirmed illustrations while retaining pending and legacy focus facts', () => {
    const result = book([
      focus('first', 'F6'),
      focus('pending', 'F3', false),
      focus('legacy', null),
      focus('second', 'F6'),
    ])
    expect(result.pages).toHaveLength(4)
    expect([...result.groups.keys()]).toEqual(['F6'])
    expect(new Set(result.groups.get('F6')!.map((p) => p.id))).toEqual(new Set(['record:first', 'record:second']))
    expect(result.pages.find((p) => p.id === 'record:pending')?.art).toBeNull()
    expect(result.pages.find((p) => p.id === 'record:legacy')?.art).toBeNull()
  })

  it('retains every rest source, its unknown metadata and distinct focus/rest identities', () => {
    const result = book([focus('shared', 'F1')], [rest('shared', '2026-11-02'), rest('old', null, 70_000)])
    expect(result.pages.map((p) => p.id)).toEqual(['rest:old', 'record:shared', 'rest:shared'])
    expect(result.groups.get('R2')!.map((p) => p.id)).toEqual(['rest:shared', 'rest:old'])
    expect(result.pages[0]).toMatchObject({ day: '日期不详', dateKey: null, kind: '休息', ending: '' })
  })

  it('keeps note identity and ownership instead of inventing a new relationship', () => {
    const linked: Thought = {
      id: 'linked',
      sessionId: 'focus',
      createdAt: 10,
      dateKey: '2026-11-02',
      text: '原来的文字',
      status: 'putAway',
      rev: 4,
      deletedAt: null,
    }
    const marker = { ...linked, id: 'marker', sessionId: null, text: '' }
    const result = book([], [], [linked, marker])
    expect(result.notes.map((n) => n.id)).toEqual(['linked', 'marker'])
    expect(result.notes[0]?.source).toBe(linked)
    expect(result.notes[1]).toMatchObject({ text: '', source: { sessionId: null } })
  })

  it('opens the latest illustrated memory and falls back to facts when no art exists', () => {
    const first = focus('illustrated', 'F2')
    const latest = { ...focus('latest', null), endedAt: 120_000 }
    const result = book([first, latest])
    expect(preferredPage(result.pages)?.id).toBe('record:illustrated')
    expect(preferredPage(book([latest]).pages)?.id).toBe('record:latest')
    expect(preferredPage([])).toBeUndefined()
  })
})
