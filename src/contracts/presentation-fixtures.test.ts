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

describe('C2-P2 presentation fixtures', () => {
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

  it('publishes stable saved scene identity independently of replay permission', () => {
    const started = fixtures.find((f) => f.name === 'focus-started')!.scene!
    expect(started).toMatchObject({ sessionId: 'f1', phase: 'focus', status: 'running', completedProgress: 0, ending: null })
    for (const name of ['restored', 'synchronized'] as const) {
      const scene = fixtures.find((f) => f.name === name)!.scene!
      expect(scene.key).toBe(started.key)
      expect(scene.id).toBe(started.id)
      expect(scene.cue).toBeNull()
    }
    expect(fixtures.find((f) => f.name === 'save-pending')!.scene).toMatchObject({ allowBeats: false, cue: null, ending: null })
  })

  it('binds saved ending tiers to their original scene and handles rest without a focus tier', () => {
    const early = fixtures.find((f) => f.name === 'ended-early')!
    expect(early.scene).toMatchObject({ sessionId: 'f1', status: 'ended', ending: { cueId: early.cue!.id, tier: 'snack' } })
    const zero = fixtures.find((f) => f.name === 'ended-zero')!
    expect(zero.scene?.ending?.tier).toBe('hello')
    const rest = fixtures.find((f) => f.name === 'break-ended')!
    expect(rest.scene).toMatchObject({ sessionId: 'b1', phase: 'break', completedProgress: 0, ending: { cueId: rest.cue!.id, tier: null } })
  })
})
