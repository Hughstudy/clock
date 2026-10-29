import { spec } from '../data/spec'
import type { CaptionKey, Pose } from '../logic/spec'
import type { TimerView } from './useViews'

export interface CharacterView {
  name: string
  pose: Pose
  caption: string
  alt: string
}

type CompanionTimerView = Pick<TimerView, 'status' | 'isBreak'>

function idleCaption(view: CompanionTimerView): CaptionKey {
  if (view.status === 'paused') return 'paused'
  if (view.isBreak) return view.status === 'running' ? 'breakRunning' : 'breakReady'
  return view.status === 'running' ? 'focusRunning' : 'focusReady'
}

/** Accept both legacy and new semantic events without coupling presentation to accounting. */
export interface CompanionReaction {
  kind: string
  id: string
}

/** Every ending gets the same welcome; active state takes priority over stale reactions. */
export function useCharacter(view: CompanionTimerView, reaction: CompanionReaction | null): CharacterView {
  const { character } = spec
  // The existing smile is a temporary shared pose, not a decision about the final mascot.
  // An early ending and a fully elapsed session must not receive different affection.
  const pose: Pose = 'idle'
  const caption = reaction && view.status === 'ready' ? 'ended' : idleCaption(view)
  return {
    name: character.name,
    pose,
    caption: character.captions[caption],
    alt: character.alt[pose],
  }
}
