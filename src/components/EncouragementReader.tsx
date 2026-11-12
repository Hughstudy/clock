import { useLayoutEffect, useRef, useState, type FocusEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { QuoteFavoritesController } from '../contracts/favorites'
import { focusCopy as copy } from '../data/focus-copy'
import { useHeadSpeech } from '../hooks/useHeadSpeech'
import type { AskPool, Encouragement } from '../logic/feedback'
import '../styles/encouragement-reader.css'

interface Props {
  quote: Encouragement
  canEdit: boolean
  favorites?: QuoteFavoritesController
  voiceRef: RefObject<HTMLElement>
  readable: boolean
  onChoose: (pool: AskPool) => void
  onNext: () => void
  onClose: () => void
}

function SpeechIcon({ kind }: { kind: 'next' | 'favorite' | 'categories' }) {
  const paths = {
    next: 'M20 10a8 8 0 0 0-14-4L3 9m0-5v5h5m-4 5a8 8 0 0 0 14 4l3-3m0 5v-5h-5',
    favorite: 'M6 4h12v16l-6-4-6 4Z', categories: 'm6 9 6 6 6-6',
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]}/></svg>
}

export function EncouragementReader({ quote, canEdit, favorites, voiceRef, readable, onChoose, onNext, onClose }: Props) {
  const speech = useRef<HTMLElement>(null)
  const onPlate = useRef<HTMLElement>(null)
  const [fits, setFits] = useState(true)
  const inScene = fits && !readable
  const focusedControl = useRef<string | null>('next')
  const trackFocus = (event: FocusEvent<HTMLElement>) => {
    const target = event.target
    if (target instanceof HTMLElement) focusedControl.current = target.dataset.speechControl ?? null
  }
  const trackBlur = (event: FocusEvent<HTMLElement>) => {
    // The same control in the other layout takes over when the focused surface disappears.
    // Moving on to another Focus tool releases it, so a later resize cannot steal focus back.
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) focusedControl.current = null
  }
  // The scene copy retains its dimensions in the compact layout so a resize can bring it back.
  useHeadSpeech(speech, quote.text, setFits, 'requested')
  useLayoutEffect(() => {
    const reader = inScene ? speech.current : onPlate.current
    if (!reader) return
    if (!inScene && focusedControl.current) {
      const plate = reader.closest<HTMLElement>('.fp-plate')
      if (plate && plate.scrollHeight > plate.clientHeight)
        plate.scrollTop += reader.getBoundingClientRect().top - plate.getBoundingClientRect().top - 8
    }
    if (focusedControl.current) {
      const control = reader.querySelector<HTMLElement>(`[data-speech-control="${focusedControl.current}"]`)
        ?? reader.querySelector<HTMLElement>('[data-speech-control="next"]')
      control?.focus({ preventScroll: true })
    }
  }, [inScene])
  useLayoutEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose])

  const pending = favorites?.isPending(quote) ?? false
  const saved = favorites?.isSaved(quote) ?? false
  const previousVersion = saved && favorites?.saved.find(item => item.id === quote.id)?.copyVersion !== quote.copyVersion
  const feedback = favorites?.detailFor(quote)
  const otherProblems = favorites?.problems.filter(problem => problem.quote.id !== quote.id && favorites.detailFor(problem.quote)) ?? []
  const category = copy.askOptions.find(option => option.pool === quote.pool) ?? copy.askOptions[0]
  const favoriteLabel = pending ? '等待保存确认' : previousVersion ? '取消旧版收藏' : saved ? '取消收藏这句' : '收藏这句'
  const footer = <div className="fp-reader-actions" role="group" aria-label="这句鼓励">
      <button type="button" className="text-action" data-speech-control="next" onClick={onNext}>
        <SpeechIcon kind="next"/>{copy.nextEncouragement}</button>
      {favorites && <button type="button" className="text-action" data-speech-control="favorite" disabled={!canEdit || pending}
        aria-label={favoriteLabel} aria-pressed={saved} onClick={() => favorites.toggle(quote)}>
        <SpeechIcon kind="favorite"/>{pending ? '待确认' : saved ? '已收藏' : '收藏'}</button>}
      <label className="fp-reader-category">
        <span aria-hidden="true">{category.label}</span><SpeechIcon kind="categories"/>
        <select aria-label={copy.chooseEncouragement} value={category.pool} data-speech-control="categories"
          onChange={event => {
            const selected = copy.askOptions.find(option => option.pool === event.target.value)
            if (selected && selected.pool !== quote.pool) onChoose(selected.pool)
          }}>
          {copy.askOptions.map(option => <option key={option.pool} value={option.pool}>{option.label}</option>)}
        </select>
      </label>
    </div>
  const feedbackNote = !!(previousVersion || feedback || otherProblems.length) && (
    <div className="fp-reader-feedback" id="focus-quote-feedback">
      {previousVersion && <p>我的收藏中保留的是这句话的原文。</p>}
      {feedback && <p>{feedback}</p>}
      {otherProblems.map(problem => <p key={problem.quote.id}>{problem.message}</p>)}
      {(pending || otherProblems.length > 0) && favorites && <button type="button" className="text-action" data-speech-control="retry" onClick={favorites.retry}>重试保存</button>}
    </div>
  )
  return <>
    <section ref={speech} className="fp-head-speech fp-companion-speech fp-encouragement" data-location="scene"
      id={inScene ? 'focus-requested-quote' : undefined} data-visible={inScene} aria-label={copy.encouragementTitle}
      onFocusCapture={trackFocus} onBlurCapture={trackBlur} aria-hidden={!inScene} aria-describedby={inScene && feedbackNote ? 'focus-quote-feedback' : undefined} {...(!inScene ? { inert: '' } : {})}>
      <p className="fp-reader-quote">{quote.text}</p>{footer}
    </section>
    {!inScene && voiceRef.current && createPortal(
      <section ref={onPlate} className="fp-encouragement" data-location="plate" id="focus-requested-quote" aria-label={copy.encouragementTitle}
        onFocusCapture={trackFocus} onBlurCapture={trackBlur} aria-describedby={feedbackNote ? 'focus-quote-feedback' : undefined}>
        <p className="fp-reader-quote">{quote.text}</p>{footer}
        <button type="button" className="text-action fp-reader-close" data-speech-control="close" onClick={onClose}>{copy.dismiss}</button>
      </section>, voiceRef.current)}
    {feedbackNote && voiceRef.current && createPortal(feedbackNote, voiceRef.current)}
  </>
}
