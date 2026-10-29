import type { CompanionState, FeedbackFrame } from './feedback'

export type CompanionStance = 'ready' | 'focused' | 'paused' | 'resting' | 'settled' | 'support' | 'neutral'
export interface CompanionPresentation {
  stance: CompanionStance
  /** Semantic cue for an optional renderer; never a business or reward event. */
  cue: 'welcome' | 'begin' | 'settle' | 'support' | null
  staticOnly: boolean
}

const STANCES: Record<CompanionState, CompanionStance> = {
  'focus-ready': 'ready', 'focus-running': 'focused', 'focus-paused': 'paused',
  'break-ready': 'resting', 'break-running': 'resting', 'break-paused': 'paused',
}

/** No character species, asset name or completion ranking crosses this boundary. */
export function companionPresentation(frame: FeedbackFrame, options: { reducedMotion: boolean; motionEnabled: boolean }): CompanionPresentation {
  const staticOnly = options.reducedMotion || !options.motionEnabled
  if (frame.status.kind === 'error') return { stance: 'neutral', cue: null, staticOnly: true }
  const pool = frame.encouragement?.pool
  let stance = STANCES[frame.companionState]
  let cue: CompanionPresentation['cue'] = null
  if (pool === 'END' || pool === 'ZER' || pool === 'BRE') { stance = 'settled'; cue = 'settle' }
  else if (frame.placement === 'requested') { stance = 'support'; cue = 'support' }
  else if (pool === 'WEL' || pool === 'RET') cue = 'welcome'
  else if (pool === 'STA') cue = 'begin'
  return { stance, cue: staticOnly ? null : cue, staticOnly }
}
