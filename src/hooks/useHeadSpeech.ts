import { useLayoutEffect, type RefObject } from 'react'

const HEAD = '.blue-companion__tuft, [data-scene-part="creature"] [data-part="tuft"]'
const TAIL_HEIGHT = 12
const HEAD_GAP = 5

/** Anchor both kinds of speech to the crown actually drawn on this frame.
 * The clock and artwork have their own fixed spaces. If the full speech does not
 * fit between them, its owner offers the appropriate reading surface instead. */
export function useHeadSpeech(speechRef: RefObject<HTMLElement>, text: string, onFit: (fits: boolean) => void) {
  useLayoutEffect(() => {
    const speech = speechRef.current, scene = speech?.closest<HTMLElement>('.fp-scene')
    if (!speech || !scene) return
    const art = scene.querySelector<HTMLElement>('.fp-art')
    const digits = scene.querySelector<HTMLElement>('.fp-digits')
    const step = scene.querySelector<HTMLElement>('.fp-step')
    const viewport = window.visualViewport
    const measure = () => {
      const head = art?.querySelector<SVGGraphicsElement>(HEAD)?.getBoundingClientRect()
      const box = scene.getBoundingClientRect(), time = digits?.getBoundingClientRect()
      // A step shown under the time is part of the readout the bubble stays clear of.
      const stepBox = step?.childElementCount && getComputedStyle(step).visibility !== 'hidden' ? step.getBoundingClientRect() : null
      const clock = time && stepBox ? { bottom: Math.max(time.bottom, stepBox.bottom) } : time
      const inset = 12, font = parseFloat(getComputedStyle(speech).fontSize)
      if (!head?.width || !clock || scene.dataset.fit === 'hidden' || box.width < font * 13 ||
          (viewport?.height ?? window.innerHeight) < font * 16) {
        onFit(false)
        return
      }
      speech.style.maxInlineSize = Math.min(320, box.width - 2 * inset) + 'px'
      const target = head.left + head.width / 2 - box.left
      const left = Math.min(box.width - speech.offsetWidth - inset, Math.max(inset, target - speech.offsetWidth * .69))
      const top = head.top - box.top - HEAD_GAP - TAIL_HEIGHT - speech.offsetHeight
      speech.style.insetInlineStart = left + 'px'
      speech.style.insetBlockStart = top + 'px'
      speech.style.setProperty('--tail-left', (target - left - 17) + 'px')
      const paragraph = speech.querySelector('p')!
      const twoLines = 2 * parseFloat(getComputedStyle(paragraph).lineHeight)
      onFit(top + box.top >= clock.bottom + 4 && paragraph.offsetHeight <= twoLines + 1)
    }
    measure()
    const sizes = new ResizeObserver(measure)
    for (const element of [scene, art, digits, step, speech]) if (element) sizes.observe(element)
    const changes = new MutationObserver(measure)
    if (art) changes.observe(art, { subtree: true, childList: true, attributes: true, attributeFilter: ['transform', 'data-scene-status'] })
    changes.observe(scene, { attributes: true, attributeFilter: ['data-fit', 'data-chrome'] })
    scene.addEventListener('transitionend', measure)
    scene.addEventListener('animationend', measure)
    viewport?.addEventListener('resize', measure)
    return () => {
      sizes.disconnect(); changes.disconnect()
      scene.removeEventListener('transitionend', measure)
      scene.removeEventListener('animationend', measure)
      viewport?.removeEventListener('resize', measure)
    }
  }, [speechRef, text, onFit])
}
