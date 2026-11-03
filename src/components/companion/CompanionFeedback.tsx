import { useState, type ReactNode } from 'react'
import type { CompanionPresentation } from '../../logic/companion'
import type { FeedbackResult } from '../../logic/feedback'
import { useCompanionView } from '../../hooks/companion/useCompanionView'
import '../../styles/companion.css'

interface Props {
  feedback: FeedbackResult
  reducedMotion: boolean
  renderCharacter: (presentation: CompanionPresentation, keyboardPat: number) => ReactNode
}

/** The companion as one control. The character handles pointer pats; keyboard activation is passed in. */
export function CompanionFeedback({ feedback, reducedMotion, renderCharacter }: Props) {
  const [keyboardPat, setKeyboardPat] = useState(0)
  const presentation = useCompanionView(feedback, reducedMotion)
  return (
    <div className="companion-feedback">
      <button type="button" className="companion-feedback__greeting" aria-label="摸摸蓝色伙伴"
        onClick={event => { if (event.detail === 0) setKeyboardPat(n => n + 1) }}>
        <span className="companion-feedback__character" aria-hidden="true">{renderCharacter(presentation, keyboardPat)}</span>
      </button>
    </div>
  )
}
