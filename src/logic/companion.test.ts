import { describe, expect, it } from 'vitest'
import { companionPresentation } from './companion'
import { feedbackCatalog } from '../data/encouragement'
import { createFeedbackMemory, transitionFeedback, type FeedbackContext } from './feedback'

const context: FeedbackContext = { phase: 'focus', status: 'ready', persistence: 'saved', participationSaved: true }
const end = (elapsedMs: number) => transitionFeedback(createFeedbackMemory(), { kind: 'focus-ended', reason: 'manual', elapsedMs, id: 'end', atMs: 0, origin: 'user' }, context, feedbackCatalog)
const ask = (override: Partial<FeedbackContext> = {}) => transitionFeedback(createFeedbackMemory(), { kind: 'encouragement-requested', id: 'ask', atMs: 0, origin: 'user' }, { ...context, ...override }, feedbackCatalog)
const motion = { reducedMotion: false, motionEnabled: true }

describe('replaceable companion presentation', () => {
  it('uses identical presentation for zero, short and fully elapsed sessions', () => {
    expect(companionPresentation(end(0).frame, motion)).toEqual(companionPresentation(end(1000).frame, motion))
    expect(companionPresentation(end(1000).frame, motion)).toEqual(companionPresentation(end(1_500_000).frame, motion))
    expect(companionPresentation(end(0).frame, motion).stance).toBe('settled')
  })

  it('keeps errors neutral even when the user explicitly requests encouragement', () => {
    const feedback = ask({ persistence: 'pending' })
    expect(companionPresentation(feedback.frame, motion)).toEqual({ stance: 'neutral', cue: null, staticOnly: true })
  })

  it.each([{ reducedMotion: true, motionEnabled: true }, { reducedMotion: false, motionEnabled: false }])('preserves character state without motion: %j', options => {
    expect(companionPresentation(ask().frame, options)).toEqual({ stance: 'support', cue: null, staticOnly: true })
  })
})
