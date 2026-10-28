import { spec } from '../data/spec'
import type { CaptionKey, Pose } from '../logic/spec'
import type { Reaction } from './useClockApp'
import type { TimerView } from './useViews'

export interface CharacterView {
  name: string
  pose: Pose
  caption: string
  alt: string
}

function idleCaption(view: TimerView): CaptionKey {
  if (view.status === 'paused') return 'paused'
  if (view.isBreak) return view.status === 'running' ? 'breakRunning' : 'breakReady'
  return view.status === 'running' ? 'focusRunning' : 'focusReady'
}

/** Whale-chan reacts to the latest reward or abandoned session, otherwise reflects the timer. */
export function useCharacter(view: TimerView, reaction: Reaction | null): CharacterView {
  const { character } = spec
  const pose: Pose = reaction?.kind ?? 'idle'
  return {
    name: character.name,
    pose,
    caption: character.captions[reaction ? reaction.kind : idleCaption(view)],
    alt: character.alt[pose],
  }
}
