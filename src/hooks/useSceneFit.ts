import { useLayoutEffect, type RefObject } from 'react'
import { fitSceneArt, TIME_GAP } from '../logic/scene-fit'

/** Keeps the Focus scene's art clear of the time, the bubble, the top controls and any local panel.
 * Writes `--fit-scale`/`--fit-shift` and `data-fit` on the scene; CSS does the rest. */
export function useSceneFit(scene: RefObject<HTMLElement>, framed: boolean): void {
  useLayoutEffect(() => {
    const root = scene.current
    if (!root) return
    let frame = 0
    const resize = new ResizeObserver(() => schedule())
    const measure = () => {
      const art = root.querySelector<SVGSVGElement>('.fp-art .blue-companion')
      // The art box ends above the floor band the card sits on; that edge is the support.
      const artBox = root.querySelector<HTMLElement>('.fp-art')
      const top = root.querySelector<HTMLElement>('.fp-top')
      const time = root.querySelector<HTMLElement>('.fp-digits')
      const panel = root.querySelector<HTMLElement>('.focus-panel')
      for (const element of [time, panel]) if (element) resize.observe(element)
      const box = root.getBoundingClientRect()
      const font = parseFloat(getComputedStyle(root).fontSize) || 16
      // Keep room for two lines and their tail even when nobody is speaking.
      // A request may open or close without moving the clock or the artwork.
      const bubbleHeight = Math.ceil(2 * font * 1.45 + 34)
      const phaseHeight = root.querySelector<HTMLElement>('.fp-clock-phase')?.offsetHeight ?? 0
      const artWidth = art ? parseFloat(getComputedStyle(art).width) : 0
      const fit = fitSceneArt({
        sceneWidth: box.width, sceneHeight: artBox?.offsetHeight || box.height,
        artWidth,
        topLimit: top ? top.getBoundingClientRect().bottom - box.top + 6 : 0,
        bubbleHeight,
        timeHeight: time ? time.offsetHeight + phaseHeight + TIME_GAP : 0,
        panelTop: panel ? panel.getBoundingClientRect().top - box.top : null,
        framed,
      })
      root.style.setProperty('--fit-scale', String(fit.scale))
      root.style.setProperty('--fit-shift', `${fit.shift}px`)
      root.dataset.fit = fit.hidden ? 'hidden' : fit.scale < 1 || fit.shift < 0 ? 'moved' : 'rest'
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    // Scene panels are direct children; they can temporarily change the support edge.
    const children = new MutationObserver(measure)
    measure()
    resize.observe(root)
    children.observe(root, { childList: true })
    window.visualViewport?.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      children.disconnect()
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [scene, framed])
}
