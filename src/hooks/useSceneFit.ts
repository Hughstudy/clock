import { useLayoutEffect, type RefObject } from 'react'
import { ART_CARD_SIDES, ART_HEAD, BUBBLE_GAP, MIN_ART_SCALE, TIME_GAP, awayGroup, fitSceneArt, shownTimeDrop, wideRoomFit } from '../logic/scene-fit'

// Matches the stylesheet's tall-landscape rule, where the room fills the screen beneath the card.
const WIDE_ROOM = '(orientation: landscape) and (min-aspect-ratio: 6/5) and (min-height: 600px)'

/** Keeps the Focus scene's art clear of the time, the bubble, the top controls and any local panel.
 * Writes `--fit-scale`/`--fit-shift` and `data-fit` on the scene; CSS does the rest. */
export function useSceneFit(scene: RefObject<HTMLElement>, framed: boolean): void {
  useLayoutEffect(() => {
    const root = scene.current
    if (!root) return
    let frame = 0
    // Where the time block was last placed with the card on screen.
    let timeDrop = 0
    const resize = new ResizeObserver(() => schedule())
    const measure = () => {
      const art = root.querySelector<SVGSVGElement>('.fp-art .blue-companion')
      // The art box ends above the floor band the card sits on; that edge is the support.
      const artBox = root.querySelector<HTMLElement>('.fp-art')
      const top = root.querySelector<HTMLElement>('.fp-top')
      const time = root.querySelector<HTMLElement>('.fp-digits')
      // Only a sheet covers the floor. The clock's popover floats over a stationary room.
      const panel = root.querySelector<HTMLElement>('.focus-panel[data-layout="sheet"]')
      // Older in-progress sessions can still carry a step beneath the time.
      const step = root.querySelector<HTMLElement>('.fp-step')
      const speechSpace = root.querySelector<HTMLElement>('.fp-speech-reserve')
      for (const element of [time, step, panel, speechSpace]) if (element) resize.observe(element)
      const box = root.getBoundingClientRect()
      const font = parseFloat(getComputedStyle(root).fontSize) || 16
      const passingHeight = Math.ceil(2 * font * 1.45 + 34)
      const topLimit = top ? top.offsetTop + top.offsetHeight + 6 : 0
      const timeBottom = time ? time.offsetTop + time.offsetHeight : 0
      const blockBottom = step ? step.offsetTop + step.offsetHeight : timeBottom
      const timeHeight = time ? Math.max(0, blockBottom - topLimit) + TIME_GAP : 0
      const sceneHeight = artBox?.offsetHeight || box.height
      const artWidth = art ? parseFloat(getComputedStyle(art).width) : 0
      // Reserve the same space while reading and at rest. On genuinely short screens
      // the card hosts the reader, leaving room for both the clock and the companion.
      const requestedHeight = Math.max(passingHeight, speechSpace?.offsetHeight ?? 0)
      const available = sceneHeight - topLimit - timeHeight - ART_HEAD * artWidth * MIN_ART_SCALE - BUBBLE_GAP
      const bubbleHeight = requestedHeight <= available ? requestedHeight : passingHeight
      const wideRoom = window.matchMedia(WIDE_ROOM).matches && root.closest<HTMLElement>('.home')?.dataset.layout !== 'readable'
      const fit = fitSceneArt({
        sceneWidth: box.width, sceneHeight,
        artWidth,
        topLimit,
        bubbleHeight,
        timeHeight,
        // Where the sheet rests, not where its entry or a drag has it for the moment.
        panelTop: panel ? panel.offsetTop - box.top : null,
        timeFloor: blockBottom + timeDrop + TIME_GAP,
        framed: framed && !wideRoom,
      })
      root.style.setProperty('--fit-scale', String(fit.scale))
      root.style.setProperty('--fit-shift', `${fit.shift}px`)
      root.dataset.fit = fit.hidden ? 'hidden' : fit.scale < 1 || fit.shift < 0 ? 'moved' : 'rest'
      const drawnWidth = artWidth * fit.scale
      if (wideRoom) {
        // The plate's visible card starts one inset inside its box.
        const plateLeft = root.closest<HTMLElement>('.home')?.querySelector('.fp-plate')?.getBoundingClientRect().left ?? box.right
        const room = wideRoomFit(box.width, drawnWidth, plateLeft + 12 - box.left)
        root.style.setProperty('--room-zoom', room.zoom.toFixed(4))
        root.style.setProperty('--card-pan', `${room.cardPan.toFixed(1)}px`)
        root.style.setProperty('--room-shift', `${room.roomShift.toFixed(2)}px`)
      } else if (drawnWidth > 0) {
        // The companion can shrink to fit under its words; the painted room still reaches both sides.
        root.style.setProperty('--room-zoom', Math.max(1, box.width / (ART_CARD_SIDES * drawnWidth)).toFixed(4))
      }
      // While the card is away, the time sits just above the companion and the spare height is shared.
      // The stylesheet names the scale and the floor kept for the handle; elsewhere both are absent.
      const awayStyle = artBox ? getComputedStyle(artBox) : null
      const awayScale = parseFloat(awayStyle?.getPropertyValue('--away-scale') ?? '') || 0
      const away = awayGroup({
        sceneHeight: box.height, artWidth, bubbleHeight: passingHeight, timeBottom, awayScale,
        awayFloor: parseFloat(awayStyle?.getPropertyValue('--away-floor') ?? '') || 0,
      })
      root.style.setProperty('--away-time-drop', `${away.timeDrop}px`)
      root.style.setProperty('--away-art-lift', `${away.artLift}px`)
      // With the card on screen the same grouping holds; only the time moves. It keeps its place
      // while a sheet has lifted the companion or sent it out, so the readout never follows a task.
      if (!panel && !fit.hidden) {
        const drop = awayScale > 0 ? shownTimeDrop({
          sceneHeight, artWidth, scale: fit.scale, bubbleHeight, blockBottom,
        }) : 0
        timeDrop = drop
        root.style.setProperty('--time-drop', `${drop}px`)
      }
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    // Scene panels are direct children; they can temporarily change the support edge.
    const children = new MutationObserver(measure)
    measure()
    // The first placement is where things are, not a move to animate.
    let settle = requestAnimationFrame(() => { settle = requestAnimationFrame(() => { root.dataset.motion = 'on' }) })
    resize.observe(root)
    children.observe(root, { childList: true })
    window.visualViewport?.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(settle)
      resize.disconnect()
      children.disconnect()
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [scene, framed])
}
