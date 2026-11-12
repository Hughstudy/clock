import { useLayoutEffect, type RefObject } from 'react'

const HEAD = '.blue-companion__tuft, [data-scene-part="creature"] [data-part="tuft"]'
const TAIL_HEIGHT = 12
const HEAD_GAP = 5

/** Anchor both kinds of speech to the crown actually drawn on this frame.
 * The clock and artwork have their own fixed spaces. If the full speech does not
 * fit between them, its owner offers the appropriate reading surface instead. */
export function useHeadSpeech(speechRef: RefObject<HTMLElement>, text: string, onFit: (fits: boolean) => void, kind: 'passing' | 'requested' = 'passing') {
  useLayoutEffect(() => {
    const speech = speechRef.current, scene = speech?.closest<HTMLElement>('.fp-scene')
    if (!speech || !scene) return
    const art = scene.querySelector<HTMLElement>('.fp-art')
    const digits = scene.querySelector<HTMLElement>('.fp-digits')
    const step = scene.querySelector<HTMLElement>('.fp-step')
    const plate = scene.closest('.home')?.querySelector<HTMLElement>('.fp-plate')
    const sideCard = window.matchMedia('(orientation: landscape) and (min-aspect-ratio: 6/5) and (min-height: 600px)')
    const viewport = window.visualViewport
    const measure = () => {
      const head = art?.querySelector<SVGGraphicsElement>(HEAD)?.getBoundingClientRect()
      const box = scene.getBoundingClientRect(), time = digits?.getBoundingClientRect()
      // A step shown under the time is part of the readout the bubble stays clear of.
      const stepBox = step?.childElementCount && getComputedStyle(step).visibility !== 'hidden' ? step.getBoundingClientRect() : null
      const clock = time && stepBox ? { bottom: Math.max(time.bottom, stepBox.bottom) } : time
      const requested = kind === 'requested'
      // Tall landscapes draw the room under a side card. Center speech in the exposed room.
      const card = plate?.getBoundingClientRect()
      const cardLeft = card?.left ?? box.right
      const width = requested && sideCard.matches && cardLeft > box.left ? Math.min(box.width, cardLeft - box.left) : box.width
      const inset = 12, font = parseFloat(getComputedStyle(speech).fontSize)
      if (!head?.width || !clock || scene.dataset.fit === 'hidden' || width < font * 13 ||
          (viewport?.height ?? window.innerHeight) < font * 16) {
        onFit(false)
        return
      }
      speech.style.maxInlineSize = Math.min(requested ? 336 : 320, width - 2 * inset) + 'px'
      const target = head.left + head.width / 2 - box.left
      const desiredLeft = requested ? (width - speech.offsetWidth) / 2 : target - speech.offsetWidth * .69
      const left = Math.min(width - speech.offsetWidth - inset, Math.max(inset, desiredLeft))
      const top = head.top - box.top - HEAD_GAP - TAIL_HEIGHT - speech.offsetHeight
      speech.style.insetInlineStart = left + 'px'
      speech.style.insetBlockStart = top + 'px'
      speech.style.setProperty('--tail-left', (target - left - 17) + 'px')
      const paragraph = speech.querySelector('p')!
      const twoLines = 2 * parseFloat(getComputedStyle(paragraph).lineHeight)
      let clearsCard = true
      if (requested && card && box.left + left < card.right && box.left + left + speech.offsetWidth > card.left) {
        // Judge the plate without the compact reader's own height. Its status and note rows
        // still count. Otherwise moving the reader there could keep it there after the room grows.
        const compactHeight = plate?.querySelector<HTMLElement>('.fp-encouragement[data-location="plate"]')?.offsetHeight ?? 0
        clearsCard = top + box.top + speech.offsetHeight <= card.top + compactHeight + 1
      }
      onFit(clearsCard && top + box.top >= clock.bottom + 4 && (requested || paragraph.offsetHeight <= twoLines + 1))
    }
    measure()
    const sizes = new ResizeObserver(measure)
    for (const element of [scene, art, digits, step, speech, plate]) if (element) sizes.observe(element)
    const changes = new MutationObserver(measure)
    if (art) changes.observe(art, { subtree: true, childList: true, attributes: true, attributeFilter: ['transform', 'data-scene-status'] })
    changes.observe(scene, { attributes: true, attributeFilter: ['data-fit', 'data-chrome', 'style'] })
    scene.addEventListener('transitionend', measure)
    scene.addEventListener('animationend', measure)
    viewport?.addEventListener('resize', measure)
    return () => {
      sizes.disconnect(); changes.disconnect()
      scene.removeEventListener('transitionend', measure)
      scene.removeEventListener('animationend', measure)
      viewport?.removeEventListener('resize', measure)
    }
  }, [speechRef, text, onFit, kind])
}
