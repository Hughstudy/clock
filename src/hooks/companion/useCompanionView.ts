import { feedbackCatalog } from '../../data/encouragement'
import { companionPresentation } from '../../logic/companion'
import type { FeedbackResult } from '../../logic/feedback'

/** View adapter only; the host owns event reduction, preferences and persistence. */
export function useCompanionView(feedback: FeedbackResult, reducedMotion: boolean, motionEnabled: boolean) {
  const presentation = companionPresentation(feedback.frame, { reducedMotion, motionEnabled })
  if (!feedback.announcement) presentation.cue = null
  const label = (id: string) => feedbackCatalog.interfaceCopy.find(c => c.id === id)!.text
  return { presentation, labels: { next: label('UI20'), bookmark: label('UI21'), bookmarked: label('UI22') } }
}
