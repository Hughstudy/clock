import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { QuoteFavoritesController } from '../contracts/favorites'
import { focusCopy as copy } from '../data/focus-copy'
import type { AskPool, Encouragement } from '../logic/feedback'
import { useHeadSpeech } from '../hooks/useHeadSpeech'
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

type Layout = 'scene' | 'viewport'

function useSpeechLayout(sceneRef: RefObject<HTMLElement>, speechRef: RefObject<HTMLElement>, text: string, detailed: boolean) {
  const [layout, setLayout] = useState<Layout>('scene')
  const current = useRef(layout)
  const restoreControl = useRef<string | undefined>(undefined)
  const place = useCallback((fits: boolean) => {
    const next = fits && !detailed ? 'scene' : 'viewport'
    if (next === current.current) return
    const focused = document.activeElement
    restoreControl.current = focused instanceof HTMLElement
      ? focused.dataset.speechControl ?? (focused.closest('.focus-panel__header') ? 'close' : undefined)
      : undefined
    current.current = next
    setLayout(next)
  }, [detailed])
  useHeadSpeech(speechRef, text, place)
  useLayoutEffect(() => {
    const id = restoreControl.current
    restoreControl.current = undefined
    if (!id) return
    const selector = id === 'close' && layout === 'viewport' ? '.focus-panel__header button' : `[data-speech-control="${id}"]`
    sceneRef.current?.closest('.home')?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
  }, [layout, sceneRef])
  return layout
}

function SpeechIcon({ kind }: { kind: 'next' | 'favorite' | 'categories' }) {
  const paths = {
    next: 'M20 10a8 8 0 0 0-14-4L3 9m0-5v5h5m-4 5a8 8 0 0 0 14 4l3-3m0 5v-5h-5',
    favorite: 'M6 4h12v16l-6-4-6 4Z', categories: 'M4 6h16M4 12h12M4 18h8',
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]}/></svg>
}

export function EncouragementReader({ quote, choosing, canEdit, favorites, sceneRef, timerSummary,
  onChoose, onChooseMode, onReturn, onNext, onClose, onBack }: Props) {
  const root = useRef<HTMLElement>(null)
  const speech = useRef<HTMLDivElement>(null)
  const category = copy.askOptions.find(option => option.pool === quote.pool)?.label ?? copy.askOptions[0].label
  const pending = favorites?.isPending(quote) ?? false
  const saved = favorites?.isSaved(quote) ?? false
  const savedText = favorites?.saved.find(item => item.id === quote.id)
  const previousVersion = saved && savedText?.copyVersion !== quote.copyVersion
  const feedback = favorites?.statusFor(quote)
  const otherProblems = favorites?.problems.filter(problem => problem.quote.id !== quote.id) ?? []
  const layout = useSpeechLayout(sceneRef, speech, quote.text, previousVersion || otherProblems.length > 0)
  useLayoutEffect(() => {
    if (layout === 'scene' && document.activeElement === document.body) {
      root.current?.querySelector<HTMLElement>('[data-speech-control="next"]')?.focus({ preventScroll: true })
    }
  }, [layout])
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

  const inScene = layout === 'scene' && !choosing
  const reader = <section ref={root} className="fp-encouragement" data-location={layout} aria-label={copy.encouragementTitle}>
    <div className="fp-reader-heading">
      <p className="fp-reader-category">{choosing ? copy.chooseEncouragement : category}</p>
      {choosing && <button type="button" className="text-action" data-speech-control="return" onClick={onReturn}>{copy.returnEncouragement}</button>}
      {layout === 'scene' && <button type="button" className="text-action" data-speech-control="close" onClick={onClose}>{copy.dismiss}</button>}
    </div>
    {choosing ? <div className="fp-reader-categories" role="group" aria-label={copy.chooseEncouragement}>
      {copy.askOptions.map(option => <button key={option.pool} type="button" className="pill pill--soft" data-speech-control={option.pool}
        aria-pressed={quote.pool === option.pool} onClick={() => onChoose(option.pool)}>{option.label}</button>)}
    </div> : <>
      {!inScene && <p className="fp-reader-quote fp-full-speech" tabIndex={-1} data-initial-focus>{quote.text}</p>}
      <div className="fp-reader-actions">
        <button type="button" className="text-action" data-speech-control="next" onClick={onNext}><SpeechIcon kind="next"/>换一句</button>
        {favorites && <button type="button" className="text-action" data-speech-control="favorite" disabled={!canEdit || pending}
          aria-pressed={saved} onClick={() => favorites.toggle(quote)}><SpeechIcon kind="favorite"/>{pending ? '等待保存确认' : previousVersion ? '取消旧版收藏' : saved ? '取消收藏' : '收藏这句'}</button>}
        <button type="button" className="text-action" data-category-opener data-speech-control="categories" onClick={onChooseMode}><SpeechIcon kind="categories"/>{copy.askCategories}</button>
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
    {sceneRef.current && createPortal(<div className="fp-head-speech fp-companion-speech" ref={speech}
      data-visible={inScene} aria-hidden={!inScene}>
      <p className={inScene ? 'fp-reader-quote' : undefined}>{quote.text}</p>
    </div>, sceneRef.current)}
    {layout === 'viewport' ? <FocusPanel title={copy.encouragementTitle} timerSummary={timerSummary}
      closeLabel={copy.dismiss} onClose={onClose} onBack={onBack}>{reader}</FocusPanel> : reader}
  </>
}
