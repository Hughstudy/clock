import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RiceBowls } from '../components/RiceBowls'
import { spec } from '../data/spec'
import { useCharacter } from './useCharacter'

const ready = { status: 'ready', isBreak: false } as const

describe('supportive companion feedback', () => {
  it('gives an early ending and a full completion identical support through legacy events', () => {
    const early = useCharacter(ready, { kind: 'cry', id: 'early' })
    const complete = useCharacter({ ...ready, isBreak: true }, { kind: 'rice', id: 'full' })
    expect(early).toEqual(complete)
    expect(early.pose).toBe('idle')
    expect(`${early.caption} ${early.alt}`).not.toMatch(/cry|tear|lost|fail|earn|saved|recorded/i)
  })

  it('accepts semantic ending events without reintroducing completion-only affection', () => {
    const early = useCharacter(ready, { kind: 'ended', id: 'early' })
    const complete = useCharacter({ ...ready, isBreak: true }, { kind: 'complete', id: 'full' })
    expect(early).toEqual(complete)
    expect(early.caption).toBe(spec.character.captions.ended)
  })

  it.each([false, true])('lets a pause override an older ending event (break=%s)', (isBreak) => {
    const current = useCharacter({ status: 'paused', isBreak }, { kind: 'rice', id: 'old' })
    expect(current.caption).toBe(spec.character.captions.paused)
    expect(current.pose).toBe('idle')
  })

  it.each([false, true])('reflects the current running phase instead of an older event (break=%s)', (isBreak) => {
    const current = useCharacter({ status: 'running', isBreak }, { kind: 'cry', id: 'old' })
    expect(current.caption).toBe(spec.character.captions[isBreak ? 'breakRunning' : 'focusRunning'])
  })

  it('returns to the ordinary welcome on reload when no transient reaction exists', () => {
    expect(useCharacter(ready, null).caption).toBe(spec.character.captions.focusReady)
    expect(useCharacter({ ...ready, isBreak: true }, null).caption).toBe(spec.character.captions.breakReady)
  })

  it.each([0, 1, 4])('describes cadence without making rest conditional at %s completed sessions', (done) => {
    const html = renderToStaticMarkup(createElement(RiceBowls, { done, total: 4 }))
    expect(html).toContain('Rest whenever you need.')
    expect(html).not.toMatch(/earned|earn a|must|keep it going/i)
  })
})
