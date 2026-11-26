import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CompanionScene, ReadingSceneView } from '../contracts/presentation'
import { CompanionSceneArt } from '../components/companion/CompanionSceneArt'
import { bookTicketAnchor, sampleScenePose } from './scene-pose'

const chapter: ReadingSceneView = { variant: 'chapter', bookmark: 'original', stage: 'linger' }
function still(reading?: ReadingSceneView) {
  const scene: CompanionScene = { key: 'test:book', sessionId: 'book', id: 'F3', phase: 'focus', status: 'paused',
    completedProgress: .85, allowBeats: false, cue: null, ending: null, ...(reading && { reading }) }
  return renderToStaticMarkup(createElement(CompanionSceneArt, { scene }))
}

describe('the authored reading activity', () => {
  it('holds the last spread during an extended session and its manual ending', () => {
    for (const status of ['running','paused','ended'] as const) {
      const frame = sampleScenePose({ id: 'F3', progress: 1, status, reading: chapter, actionKind: 'ending', actionProgress: .8 })
      expect(frame.book.close).toBe(0)
      expect(frame.book.ticketPosition).toBe(0)
    }
    expect(sampleScenePose({ id: 'F3', progress: .85 }).book.close).toBeGreaterThan(0)
    expect(still()).not.toContain('data-reading-stage')
    expect(still()).not.toContain('data-scene-part="reading-ticket"')
  })

  it('moves the ticket with the palm and supports the closing cover on the saved result', () => {
    const reading: ReadingSceneView = { ...chapter, stage: 'closed' }
    let moved = false, rotated = false
    for (let i = 0; i <= 100; i++) {
      const frame = sampleScenePose({ id: 'F3', reading, progress: 1, status: 'ended', actionKind: 'ending', actionProgress: i / 100 })
      if (frame.book.ticketPosition > 0 && frame.book.ticketPosition < 1) {
        moved = true
        expect(frame.left.palm.x).toBeCloseTo(bookTicketAnchor(frame.book.ticketPosition).x)
        expect(frame.left.palm.y).toBeCloseTo(bookTicketAnchor(frame.book.ticketPosition).y)
      }
      if (frame.book.close > 0 && frame.book.close < 1) {
        rotated = true
        expect(frame.contacts.some(c => c.active && c.name.startsWith('cover-'))).toBe(true)
      }
    }
    expect(moved && rotated).toBe(true)
    const reloaded = sampleScenePose({ id: 'F3', reading, progress: 1, status: 'ended', staticOnly: true })
    expect(reloaded.book.close).toBe(1)
    expect(reloaded.book.ticketPosition).toBe(1)
  })

  it('keeps the current ticket in the short story, and gives each still its own illustrated page', () => {
    const reading = { ...chapter, variant: 'hat', bookmark: 'next' } as const
    for (const [stage, part] of [['open','data-cap="worn"'], ['turn','reading-bakery'], ['found','data-cap="carried"']] as const) {
      const markup = still({ ...reading, stage })
      expect(markup).toContain(part)
      expect(markup).toContain('data-bookmark="next"')
      expect(markup).not.toMatch(/<button|tabindex=|aria-live=/)
    }
  })
})
