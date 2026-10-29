import raw from './encouragement.zh-CN.json'
import { parseFeedbackCatalog } from '../logic/feedback'

/** Validated candidate copy; inject into the pure feedback reducer. */
export const feedbackCatalog = parseFeedbackCatalog(raw)
