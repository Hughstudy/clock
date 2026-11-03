import { companionPresentation, type CompanionPresentation } from '../../logic/companion'
import type { FeedbackResult } from '../../logic/feedback'

/** View adapter only; the host owns event reduction, preferences and persistence. */
export function useCompanionView(feedback: FeedbackResult, reducedMotion: boolean): CompanionPresentation {
  const presentation = companionPresentation(feedback.frame, { reducedMotion, motionEnabled: true })
  if (!feedback.announcement) presentation.cue = null
  return presentation
}
