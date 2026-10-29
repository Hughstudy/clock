import { describe, expect, it } from 'vitest'
import { FIXTURE_NAMES, presentationFixtures, type FixtureName } from './presentation-fixtures'
import type { CueKind } from './presentation'

/** The published outcome of each fixture: permitted cue, whether main announces, and the factual status. */
const EXPECTED: Record<FixtureName, { cue: CueKind | null; announced: boolean; status: string; error?: true }> = {
  ready: { cue: null, announced: false, status: 'ready' },
  'focus-started': { cue: 'begin', announced: true, status: 'UI27' },
  paused: { cue: 'pause', announced: true, status: 'UI26' },
  resumed: { cue: 'resume', announced: true, status: 'UI27' },
  'ended-elapsed': { cue: 'settle', announced: true, status: 'UI30' },
  'ended-early': { cue: 'settle', announced: true, status: 'UI30' },
  'ended-zero': { cue: 'settle', announced: true, status: 'UI31' },
  'thought-marker': { cue: 'thought-saved', announced: true, status: 'UI32' },
  'thought-text': { cue: 'thought-saved', announced: true, status: 'UI33' },
  'break-started': { cue: 'rest', announced: true, status: 'break-running' },
  'break-ended': { cue: 'settle', announced: true, status: 'UI36' },
  requested: { cue: 'support', announced: true, status: 'ready' },
  'save-pending': { cue: null, announced: true, status: 'pending', error: true },
  'save-retried': { cue: null, announced: false, status: 'UI27' },
  restored: { cue: null, announced: false, status: 'UI29' },
  synchronized: { cue: null, announced: false, status: 'UI29' },
  'stale-result': { cue: null, announced: false, status: 'UI26' },
  'hidden-screen': { cue: null, announced: false, status: 'UI27' },
  'motion-disabled': { cue: 'begin', announced: true, status: 'UI27' },
}

describe('C2-P1 presentation fixtures', () => {
  const fixtures = presentationFixtures()

  it('covers every published scenario once', () => {
    expect(fixtures.map((f) => f.name)).toEqual([...FIXTURE_NAMES])
  })

  it.each(FIXTURE_NAMES)('%s has the published cue, announcement and factual status', (name) => {
    const f = fixtures.find((x) => x.name === name)!
    const expected = EXPECTED[name]
    expect(f.cue?.kind ?? null).toBe(expected.cue)
    expect(f.feedback.announcement !== null).toBe(expected.announced)
    expect(f.feedback.frame.status.id).toBe(expected.status)
    expect(f.view.hasError).toBe(expected.error === true)
  })

  it('gives cues an identity independent of the announcement and never a cue with an error', () => {
    for (const f of fixtures) {
      if (f.cue) expect(f.cue.id).not.toBe(f.feedback.announcement?.id)
      if (f.view.hasError) expect(f.cue).toBeNull()
    }
  })

  it('keeps the recorded time factual alongside encouragement for every ending', () => {
    for (const name of ['ended-elapsed', 'ended-early', 'ended-zero'] as const) {
      const f = fixtures.find((x) => x.name === name)!
      expect(f.feedback.frame.status.result).toBe(true)
    }
    expect(fixtures.find((x) => x.name === 'ended-early')!.feedback.frame.status.text).toContain('3分钟20秒')
  })

  it('links thought cues to their thought and session, and reports preferences without deciding motion', () => {
    const text = fixtures.find((x) => x.name === 'thought-text')!
    expect(text.cue).toMatchObject({ thoughtId: 'n1', sessionId: 'f1' })
    expect(fixtures.find((x) => x.name === 'motion-disabled')!.view.preferences.motionEnabled).toBe(false)
  })
})
