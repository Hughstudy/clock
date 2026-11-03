import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { QuoteFavoritesController } from '../contracts/favorites'
import { focusCopy as copy } from '../data/focus-copy'
import type { AskPool, Encouragement } from '../logic/feedback'
import { FocusPanel } from './FocusPanel'
import '../styles/encouragement-reader.css'

interface Props {
  quote: Encouragement
  choosing: boolean
  canEdit: boolean
  favorites?: QuoteFavoritesController
  sceneRef: RefObject<HTMLDivElement>
  timerSummary: string
  onChoose: (pool: AskPool) => void
  onChooseMode: () => void
  onReturn: () => void
  onNext: () => void
  onClose: () => void
  onBack: () => void
}

type Layout = 'scene' | 'dock' | 'viewport'

/** Try the space beside the top buttons, then the room directly above the painted silhouette.
 * The bubble adapts to the art; its geometry never enters the character's scale/position fit. */
function useSpeechLayout(sceneRef: RefObject<HTMLElement>, speechRef: RefObject<HTMLElement>, text: string) {
  const [layout, setLayout] = useState<Layout>('dock')
  const current = useRef(layout)
  const restoreControl = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    const scene = sceneRef.current, speech = speechRef.current
    if (!scene || !speech) return
    const controls = scene.querySelector<HTMLButtonElement>('.fp-top button')
    const art = scene.querySelector<HTMLElement>('.fp-art')
    const viewport = window.visualViewport
    const place = (next: Layout) => {
      if (next === current.current) return
      if (next === 'viewport' || current.current === 'viewport') {
        const focused = document.activeElement
        restoreControl.current = focused instanceof HTMLElement
          ? focused.dataset.speechControl ?? (focused.closest('.focus-panel__header') ? 'close' : undefined)
          : undefined
      }
      current.current = next
      setLayout(next)
    }
    const measure = () => {
      const box = scene.getBoundingClientRect()
      const font = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      if ((viewport?.height ?? window.innerHeight) < font * 19 || box.width < font * 15) {
        place('viewport'); return
      }
      const top = controls?.getBoundingClientRect()
      const subjects = art?.querySelectorAll('.blue-companion__body, [data-scene-part="creature"], [data-scene-part="arms"]')
      if (!top || !subjects?.length || scene.dataset.fit === 'hidden') { place('dock'); return }
      const upperEdge = Math.min(...Array.from(subjects, subject => subject.getBoundingClientRect().top))
      const left = 12, gap = 8
      const candidates = [
        { width: top.left - box.left - left - gap, y: top.top - box.top },
        { width: box.width - 2 * left, y: top.bottom - box.top + gap },
      ]
      for (const { width, y } of candidates) {
        if (width < 7 * font) continue
        speech.style.inlineSize = `${Math.min(320, width)}px`
        speech.style.insetBlockStart = `${y}px`
        if (box.top + y + speech.offsetHeight + gap + 2 <= upperEdge) {
          place('scene'); return
        }
      }
      place('dock')
    }
    measure()
    const sizes = new ResizeObserver(measure)
    for (const element of [scene, controls, speech]) if (element) sizes.observe(element)
    const changes = new MutationObserver(measure)
    if (art) changes.observe(art, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-scene', 'data-scene-status'] })
    scene.addEventListener('transitionend', measure)
    viewport?.addEventListener('resize', measure)
    return () => {
      sizes.disconnect(); changes.disconnect()
      scene.removeEventListener('transitionend', measure)
      viewport?.removeEventListener('resize', measure)
    }
  }, [sceneRef, speechRef, text])
  useLayoutEffect(() => {
    const id = restoreControl.current
    restoreControl.current = undefined
    if (!id) return
    const home = sceneRef.current?.closest('.home')
    const selector = id === 'close' ? (layout === 'viewport' ? '.focus-panel__header button' : '.fp-top button:first-child')
      : `[data-speech-control="${id}"]`
    home?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
  }, [layout, sceneRef])
  return layout
}

export function EncouragementReader({ quote, choosing, canEdit, favorites, sceneRef, timerSummary,
  onChoose, onChooseMode, onReturn, onNext, onClose, onBack }: Props) {
  const root = useRef<HTMLElement>(null)
  const speech = useRef<HTMLDivElement>(null)
  const layout = useSpeechLayout(sceneRef, speech, quote.text)
  const wasChoosing = useRef(choosing)
  useLayoutEffect(() => {
    if (wasChoosing.current === choosing) return
    wasChoosing.current = choosing
    root.current?.querySelector<HTMLElement>(choosing ? '[aria-pressed="true"]' : '[data-category-opener]')?.focus()
  }, [choosing])
  useLayoutEffect(() => {
    if (layout === 'viewport') return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
      event.preventDefault(); onBack()
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [layout, onBack])

  const category = copy.askOptions.find(option => option.pool === quote.pool)?.label ?? copy.askOptions[0].label
  const pending = favorites?.isPending(quote) ?? false
  const saved = favorites?.isSaved(quote) ?? false
  const savedText = favorites?.saved.find(item => item.id === quote.id)
  const previousVersion = saved && savedText?.copyVersion !== quote.copyVersion
  const feedback = favorites?.statusFor(quote)
  const otherProblems = favorites?.problems.filter(problem => problem.quote.id !== quote.id) ?? []
  const inScene = layout === 'scene' && !choosing
  const reader = <section ref={root} className="fp-encouragement" data-location={layout} aria-label={copy.encouragementTitle}>
    {choosing ? <>
      <h3 className="sr-only">{copy.chooseEncouragement}</h3>
      <div className="fp-reader-categories" role="group" aria-label={copy.chooseEncouragement}>
        {copy.askOptions.map(option => <button key={option.pool} type="button" className="pill pill--soft" data-speech-control={option.pool}
          aria-pressed={quote.pool === option.pool} onClick={() => onChoose(option.pool)}>{option.label}</button>)}
      </div>
      <button type="button" className="text-action" data-speech-control="return" onClick={onReturn}>{copy.returnEncouragement}</button>
    </> : <>
      {!inScene && <p className="fp-reader-quote fp-docked-speech" tabIndex={-1} data-initial-focus>{quote.text}</p>}
      <p className="fp-reader-category">{category}</p>
      <div className="fp-reader-actions">
        <button type="button" className="text-action" data-speech-control="next" onClick={onNext}>换一句</button>
        {favorites && <button type="button" className="text-action" data-speech-control="favorite" disabled={!canEdit || pending}
          aria-pressed={saved} onClick={() => favorites.toggle(quote)}>{pending ? '等待保存确认' : previousVersion ? '取消旧版收藏' : saved ? '取消收藏' : '收藏这句'}</button>}
        <button type="button" className="text-action" data-category-opener data-speech-control="categories" onClick={onChooseMode}>{copy.askCategories}</button>
      </div>
    </>}
    {!!(feedback || previousVersion || pending || otherProblems.length) && <div className="fp-reader-feedback">
        {previousVersion && <p>我的收藏中保留的是这句话的原文。</p>}
        {feedback && <p>{feedback}</p>}
        {otherProblems.map(problem => <p key={problem.quote.id}>{problem.message}</p>)}
        {(pending || otherProblems.length > 0) && favorites && <button type="button" className="text-action" data-speech-control="retry" onClick={favorites.retry}>重试保存</button>}
    </div>}
  </section>
  return <>
    {sceneRef.current && createPortal(<div className="fp-companion-speech" ref={speech}
      data-visible={inScene} aria-hidden={!inScene}>
      <p className={inScene ? 'fp-reader-quote' : undefined}>{quote.text}</p>
    </div>, sceneRef.current)}
    {layout === 'viewport' ? <FocusPanel placement="viewport" title={copy.encouragementTitle} timerSummary={timerSummary}
      closeLabel={copy.dismiss} onClose={onClose} onBack={onBack}>{reader}</FocusPanel> : reader}
  </>
}
