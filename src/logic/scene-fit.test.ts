import { describe, expect, it } from 'vitest'
import { ART_CARD, ART_HEAD, ART_MAX_SCENE_RATIO, BUBBLE_RESERVE, fitSceneArt, PANEL_TUCK, plateRise, ROOM_MIN_ZOOM, wideRoomFit, type SceneFitInput } from './scene-fit'

const phone: SceneFitInput = { sceneWidth: 393, sceneHeight: 570, artWidth: 565, topLimit: 50, bubbleHeight: 0, timeHeight: 0, panelTop: null, framed: true }
const headTop = (input: SceneFitInput, fit: ReturnType<typeof fitSceneArt>) =>
  input.sceneHeight + fit.shift - ART_HEAD * input.artWidth * fit.scale

describe('wideRoomFit', () => {
  const roomWidth = (zoom: number, artWidth: number) => 234 * zoom * artWidth / 240

  it.each([[1180, 1050, 840], [1024, 855, 684], [1366, 1282, 1026]])('moves %i wide art clear of the card and still covers both edges', (width, art, cardLeft) => {
    const { zoom, cardPan, roomShift } = wideRoomFit(width, art, cardLeft)
    expect(width / 2 - cardPan + art * 0.32).toBeLessThanOrEqual(cardLeft - 8 + 1e-6)
    const half = roomWidth(zoom, art) / 2
    const shiftPx = roomShift * 0.75 * art / 240
    for (const centre of [width / 2 + shiftPx, width / 2 - cardPan + shiftPx]) {
      expect(centre - half).toBeLessThanOrEqual(0)
      expect(centre + half).toBeGreaterThanOrEqual(width)
    }
  })

  it('does not move the scene when the card is already clear', () => {
    expect(wideRoomFit(1600, 900, 1500).cardPan).toBe(0)
  })

  it('falls back to the base size before the art has been measured', () => {
    expect(wideRoomFit(1180, 0, 840)).toEqual({ zoom: ROOM_MIN_ZOOM, cardPan: 0, roomShift: 0 })
  })
})

describe('fitSceneArt', () => {
  it('leaves the art untouched when nothing competes for the space', () => {
    expect(fitSceneArt(phone)).toEqual({ scale: 1, shift: 0, hidden: false })
    expect(fitSceneArt({ ...phone, bubbleHeight: 33 })).toEqual({ scale: 1, shift: 0, hidden: false })
  })

  it('never grows the art so wide that a side prop leaves a narrow screen', () => {
    const tall = { ...phone, sceneWidth: 375, sceneHeight: 760, artWidth: 640 }
    const fit = fitSceneArt(tall)
    expect(fit.scale * tall.artWidth).toBeCloseTo(375 * ART_MAX_SCENE_RATIO, 5)
    expect(fit.hidden).toBe(false)
  })

  it('shrinks just enough for a tall bubble to sit between the head and the top controls', () => {
    const input = { ...phone, sceneWidth: 375, sceneHeight: 407, artWidth: 539, bubbleHeight: 90 }
    const fit = fitSceneArt(input)
    expect(fit.scale).toBeLessThan(1)
    expect(fit.shift).toBe(0)
    expect(headTop(input, fit) - 10 - 90).toBeCloseTo(input.topLimit, 5)
  })

  it('keeps the time readout and the bubble stacked between the head and the top controls', () => {
    const input = { ...phone, sceneWidth: 375, sceneHeight: 407, artWidth: 539, bubbleHeight: 60, timeHeight: 52 }
    const fit = fitSceneArt(input)
    expect(fit.scale).toBeLessThan(fitSceneArt({ ...input, timeHeight: 0 }).scale)
    expect(headTop(input, fit) - 10 - 60 - 52).toBeCloseTo(input.topLimit, 5)
  })

  it('keeps a one-line bubble\'s room above the head while the time reads there', () => {
    const input = { ...phone, sceneWidth: 375, sceneHeight: 407, artWidth: 539, bubbleHeight: 0, timeHeight: 52 }
    const fit = fitSceneArt(input)
    expect(headTop(input, fit) - BUBBLE_RESERVE - 52).toBeCloseTo(input.topLimit, 5)
    expect(fitSceneArt({ ...input, bubbleHeight: 30 })).toEqual(fit)
  })

  it('lifts the support edge onto an open panel and keeps the head below the top controls', () => {
    const input = { ...phone, panelTop: 412 }
    const fit = fitSceneArt(input)
    expect(input.sceneHeight + fit.shift).toBe(412 + PANEL_TUCK)
    expect(fit.scale).toBe(1)
    expect(headTop(input, fit)).toBeGreaterThanOrEqual(input.topLimit)
  })

  it('keeps the whole scenery card clear once its edges would show', () => {
    const input = { ...phone, panelTop: 200 }
    const fit = fitSceneArt(input)
    const cardTop = input.sceneHeight + fit.shift - ART_CARD * input.artWidth * fit.scale
    expect(fit.hidden).toBe(false)
    expect(cardTop).toBeGreaterThanOrEqual(input.topLimit - 1e-9)
    // Without scenery there is no card to keep clear, so it may stay larger.
    expect(fitSceneArt({ ...input, framed: false }).scale).toBeGreaterThan(fit.scale)
  })

  it('steps the companion out instead of showing a tiny one', () => {
    const fit = fitSceneArt({ ...phone, sceneWidth: 375, sceneHeight: 407, artWidth: 539, panelTop: 150 })
    expect(fit.hidden).toBe(true)
  })

  it('ignores an unmeasured art box', () => {
    expect(fitSceneArt({ ...phone, artWidth: 0 })).toEqual({ scale: 1, shift: 0, hidden: false })
  })

  it('measures how far the card has grown above its band, and nothing when it sits beside the scene', () => {
    expect(plateRise(268, 268)).toBe(0)
    expect(plateRise(312, 268)).toBe(44)
    expect(plateRise(260, 268)).toBe(0)
    expect(plateRise(340, 0)).toBe(0)
  })
})
