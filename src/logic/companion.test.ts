import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CompanionFeedback } from '../components/companion/CompanionFeedback'
import { companionPresentation } from './companion'
import { feedbackCatalog } from '../data/encouragement'
import { createFeedbackMemory, transitionFeedback, type FeedbackContext, type FeedbackEvent } from './feedback'

const context: FeedbackContext = { phase: 'focus', status: 'ready', initialized: true, persistence: 'saved', participationSaved: true }
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
    const feedback = ask({ persistence: 'pending', error: 'ERR01' })
    expect(companionPresentation(feedback.frame, motion)).toEqual({ stance: 'neutral', cue: null, staticOnly: true })
  })

  it.each([{ reducedMotion: true, motionEnabled: true }, { reducedMotion: false, motionEnabled: false }])('preserves character state without motion: %j', options => {
    expect(companionPresentation(ask().frame, options)).toEqual({ stance: 'support', cue: null, staticOnly: true })
  })

  it('lets a caller replace the visual while preserving semantic status and text', () => {
    const html = renderToStaticMarkup(createElement(CompanionFeedback, {
      feedback: ask(), reducedMotion: true,
      renderCharacter: view => createElement('span', { 'data-test-stance': view.stance }, 'custom visual'),
    }))
    expect(html).toContain('data-test-stance="support"')
    expect(html).toContain('你值得被温柔地对待。')
    expect(html).not.toContain('<svg')
  })

  it('only renders enabled capabilities and never claims saved on a button click', () => {
    const feedback = ask()
    const bare = renderToStaticMarkup(createElement(CompanionFeedback, { feedback, reducedMotion: true }))
    expect(bare).not.toContain('<button')
    const available = renderToStaticMarkup(createElement(CompanionFeedback, { feedback, reducedMotion: true, onBookmark: () => undefined, onNext: () => undefined }))
    expect(available).toContain('收藏这句'); expect(available).toContain('换一句')
    expect(available).not.toContain('已收藏')
    const saved = renderToStaticMarkup(createElement(CompanionFeedback, { feedback, reducedMotion: true, onBookmark: () => undefined, bookmarkState: 'saved' }))
    expect(saved).toContain('已收藏'); expect(saved).toContain('disabled=""')
  })

  it('shows technical errors ahead of supportive text and exposes a single live region', () => {
    const feedback = ask({ persistence: 'pending', error: 'ERR01' })
    const html = renderToStaticMarkup(createElement(CompanionFeedback, { feedback, reducedMotion: true }))
    expect(html.indexOf('这次记录还没保存成功')).toBeLessThan(html.indexOf('你值得被温柔地对待'))
    expect(html.match(/aria-live=/g)).toHaveLength(1)
    expect(html).toContain('aria-live="assertive"')
  })

  it('keeps in-flight saving visible beside an explicitly requested phrase', () => {
    const feedback = ask({ persistence: 'saving' })
    const html = renderToStaticMarkup(createElement(CompanionFeedback, { feedback, reducedMotion: true, announce: false }))
    expect(html).toContain('正在保存。')
    expect(html).toContain('你值得被温柔地对待。')
    expect(html).not.toContain('aria-live=')
  })

  it('keeps long text intact and leaves repeated delivery out of the live region', () => {
    const first = ask()
    const e: FeedbackEvent = { kind: 'encouragement-requested', id: 'next', atMs: 1, origin: 'user' }
    const deep = transitionFeedback(first.state, e, context, feedbackCatalog)
    expect(deep.frame.encouragement?.id).toBe('ASKG09')
    const duplicate = transitionFeedback(deep.state, e, context, feedbackCatalog)
    const html = renderToStaticMarkup(createElement(CompanionFeedback, { feedback: duplicate, reducedMotion: true }))
    expect(html).toContain(deep.frame.encouragement!.text)
    expect(html).toContain('aria-atomic="true"></span>')
  })
})
