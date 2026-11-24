import { memo, type CSSProperties } from 'react'
import type { SceneId } from '../../logic/types'
import { restJournalMarkup } from './book-projection'
import './prop.css'

type Place = SceneId | 'ready' | 'plain'
// Center of the visible silhouette and unprojected cover width within the
// 320 × 253⅓ scene, before the renderer's .75 scale into its 240 × 190 view.
type Placement = readonly [x: number, y: number, width: number, support: string]
const placements: Record<Place, Placement> = {
  ready: [231, 210, 42, 'workroom-floor'],
  plain: [229, 211, 40, 'floor'],
  F1: [250.5, 177.5, 27, 'table-beside-bowls'],
  F2: [239, 178, 32, 'table-away-from-plant'],
  F3: [238, 177.5, 33, 'table-beside-reading-book'],
  F4: [236, 211, 39, 'floor-beside-tea-table'],
  F5: [78, 209.5, 37, 'mat-away-from-bubble-jar'],
  F6: [83, 177.5, 37, 'left-corner-of-boat-table'],
  F7: [89, 216, 38, 'floor-beside-block-table'],
  F8: [247, 209, 31, 'mat-beside-stargazing-cushion'],
  R1: [82, 210, 37, 'stretching-mat'],
  R2: [74, 209, 31, 'mat-beside-cloud-cushion'],
  R3: [74, 210, 31, 'mat-away-from-drink'],
}

const restingArtwork = { __html: restJournalMarkup }

export const SceneRecordBook = memo(function SceneRecordBook({ place, active, onOpen }: {
  place: Place
  active: boolean
  onOpen: () => void
}) {
  const [x, y, width, support] = placements[place]
  return (
    <div className="scene-book-plane">
      <button type="button" data-scene-book-trigger="" data-book-scene={place} data-book-support={support}
        className="scene-book-trigger" aria-label="打开场景里的手帐" disabled={!active} onClick={onOpen}
        style={{
          left: `${x / 320 * 100}%`,
          top: `${y * .75 / 190 * 100}%`,
          '--book-span': `${width / 320 * 100}cqw`,
        } as CSSProperties}>
        <span data-scene-book-shadow="" aria-hidden="true" />
        <span data-scene-book-block="" data-scene-book="" aria-hidden="true" dangerouslySetInnerHTML={restingArtwork} />
      </button>
    </div>
  )
})
