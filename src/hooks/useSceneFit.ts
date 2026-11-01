import { useLayoutEffect, type RefObject } from 'react'
import { fitSceneArt } from '../logic/scene-fit'

/** Keeps the Focus scene's art clear of the bubble, the top controls and any local panel.
 * Writes `--fit-scale`/`--fit-shift` and `data-fit` on the scene; CSS does the rest. */
export function useSceneFit(scene: RefObject<HTMLElement>, framed: boolean): void {
  useLayoutEffect(() => {
    const root = scene.current
    if (!root) return
    let frame = 0
    const resize = new ResizeObserver(() => schedule())
    const measure = () => {
      const art = root.querySelector<SVGSVGElement>('.fp-art .blue-companion')
      const top = root.querySelector<HTMLElement>('.fp-top')
      const bubble = root.querySelector<HTMLElement>('.fp-bubble')
      const panel = root.querySelector<HTMLElement>('.focus-panel')
      for (const element of [bubble, panel]) if (element) resize.observe(element)
      const box = root.getBoundingClientRect()
      const fit = fitSceneArt({
        sceneWidth: box.width, sceneHeight: box.height,
        artWidth: art ? parseFloat(getComputedStyle(art).width) : 0,
        topLimit: top ? top.getBoundingClientRect().bottom - box.top + 6 : 0,
        bubbleHeight: bubble?.offsetHeight ?? 0,
        panelTop: panel ? panel.getBoundingClientRect().top - box.top : null,
        framed,
      })
      root.style.setProperty('--fit-scale', String(fit.scale))
      root.style.setProperty('--fit-shift', `${fit.shift}px`)
      root.dataset.fit = fit.hidden ? 'hidden' : fit.scale < 1 || fit.shift < 0 ? 'moved' : 'rest'
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    // The bubble and the panel are direct children of the scene.
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
