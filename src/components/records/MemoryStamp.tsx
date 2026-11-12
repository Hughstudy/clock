import type { SceneId } from '../../logic/types'
import { ScenePart } from '../companion/CompanionSceneArt'

/** Each sketch uses the same props as its activity. The room and its furniture are initial scenery. */
const sketches: Record<SceneId, { box: string; parts: string[] }> = {
  F1: { box: '-10 -13 69 56', parts: ['pot', 'potHandles', 'potLid', 'lidKnob'] },
  F2: { box: '-3 -49 42 79', parts: ['stem', 'leaves', 'plantPot', 'plantRim'] },
  F3: { box: '-5 -7 82 49', parts: ['bookLeft', 'bookRight', 'bookCover', 'bookLines', 'bookmark'] },
  F4: { box: '-8 -9 54 43', parts: ['saucer', 'cup', 'cupTea'] },
  F5: { box: '-15 -14 31 30', parts: ['bubble', 'bubbleShine'] },
  F6: { box: '-4 -28 76 53', parts: ['boat', 'boatStripe'] },
  F7: { box: '-4 -7 32 33', parts: ['blockGold'] },
  F8: { box: '-14 -15 28 29', parts: ['star'] },
  R1: { box: '33 14 174 165', parts: ['footLeft', 'footRight', 'tuft', 'body', 'shine', 'belly', 'armLeftHappy', 'armRightHappy', 'cheekLeft', 'cheekRight', 'eyesResting', 'mouth'] },
  R2: { box: '-10 -28 92 54', parts: ['cloud'] },
  R3: { box: '-6 -26 54 57', parts: ['saucer', 'cup', 'cupTea', 'steam'] },
}
export function MemorySketch({ id }: { id: SceneId }) {
  const { box, parts } = sketches[id]
  return <svg viewBox={box} className="room-sketch" aria-hidden="true" focusable="false">
    {parts.map(name => <ScenePart key={name} name={name}/>)}
  </svg>
}

/** The same picture identifies a saved activity on the postcard, timeline and shelf. */
export function MemoryStamp({ id }: { id: SceneId }) {
  return <span className="memory-stamp" data-picture={id} aria-hidden="true">
    <span className="memory-stamp-print"><MemorySketch id={id}/></span>
  </span>
}
