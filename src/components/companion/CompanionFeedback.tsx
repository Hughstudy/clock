import type { ReactNode } from 'react'
import type { CompanionPresentation } from '../../logic/companion'
import type { FeedbackResult } from '../../logic/feedback'
import { useCompanionView } from '../../hooks/companion/useCompanionView'
import '../../styles/companion.css'

interface Props {
  feedback: FeedbackResult
  reducedMotion: boolean
  motionEnabled?: boolean
  /** A replaceable visual slot. The default is a static, unbranded placeholder. */
  renderCharacter?: (presentation: CompanionPresentation) => ReactNode
  onNext?: () => void
  onBookmark?: () => void
  onDismiss?: () => void
  onRequest?: () => void
  /** The app keeps one live region above navigation. Standalone previews may announce here. */
  announce?: boolean
  bookmarkState?: 'available' | 'saving' | 'saved' | 'failed'
  /** Omit routine timer status that another element already shows; results and errors stay. */
  quietStatus?: boolean
}

function Placeholder() {
  return (
    <svg className="companion-feedback__placeholder" viewBox="0 0 120 90" aria-hidden="true" focusable="false">
      <path d="M20 55C20 25 36 15 60 15S100 25 100 55C100 75 81 78 60 78S20 75 20 55Z" fill="currentColor" opacity=".15" />
      <circle cx="44" cy="46" r="3" fill="currentColor" /><circle cx="76" cy="46" r="3" fill="currentColor" />
      <path d="M48 60Q60 70 72 60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Presentation only: all operations are callbacks, including saved/failed bookmark state. */
export function CompanionFeedback({ feedback, reducedMotion, motionEnabled = false, renderCharacter, onNext, onBookmark, onDismiss, onRequest, announce = true, bookmarkState = 'available', quietStatus = false }: Props) {
  const { frame, announcement } = feedback
  const { presentation, labels } = useCompanionView(feedback, reducedMotion, motionEnabled)
  const requested = frame.placement === 'requested' && frame.encouragement !== null
  return (
    <section className="companion-feedback" aria-label="陪伴与状态" data-stance={presentation.stance} data-static={presentation.staticOnly} data-placement={frame.placement}>
      {onRequest ? (
        <button type="button" className="companion-feedback__greeting" onClick={onRequest} aria-label="给我一句鼓励">
          <span className="companion-feedback__character" aria-hidden="true">{renderCharacter ? renderCharacter(presentation) : <Placeholder />}</span>
          <span className="companion-feedback__invite">给我一句鼓励 <span aria-hidden="true">↗</span></span>
        </button>
      ) : <div className="companion-feedback__character" aria-hidden="true">{renderCharacter ? renderCharacter(presentation) : <Placeholder />}</div>}
      <div className="companion-feedback__content">
        {(frame.persistence !== 'saved' || frame.status.kind === 'error' || frame.status.result || (!frame.encouragement && !quietStatus)) && <p className={`companion-feedback__status${frame.status.kind === 'error' ? ' companion-feedback__status--error' : ''}`}>{frame.status.text}</p>}
        {frame.encouragement && <p className="companion-feedback__copy">{frame.encouragement.text}</p>}
        <div className="companion-feedback__actions">
          {requested && onNext && <button type="button" onClick={onNext}>{labels.next}</button>}
          {requested && onBookmark && <button type="button" onClick={onBookmark} disabled={bookmarkState === 'saving' || bookmarkState === 'saved'}>{bookmarkState === 'saved' ? labels.bookmarked : bookmarkState === 'saving' ? '正在收藏…' : labels.bookmark}</button>}
          {requested && onDismiss && <button type="button" onClick={onDismiss}>收起</button>}
        </div>
      </div>
      {announce && <span className="companion-feedback__live" aria-live={announcement?.priority ?? 'polite'} aria-atomic="true">{announcement?.text ?? ''}</span>}
    </section>
  )
}
