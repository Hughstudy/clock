import { sceneNames } from '../data/scene-copy'
import type { RecordsBand } from '../logic/record-stories'
import type { FocusSceneId } from '../logic/types'
import { ScenePart } from './companion/CompanionSceneArt'
import { RecordsGreetingArt } from './companion/RecordsArt'

/** Each sketch uses the same props as its activity. The room and its furniture are initial scenery. */
const sketches: Record<FocusSceneId, { box: string; parts: string[] }> = {
  F1: { box: '-10 -13 69 56', parts: ['pot', 'potHandles', 'potLid', 'lidKnob'] },
  F2: { box: '-3 -49 42 79', parts: ['stem', 'leaves', 'plantPot', 'plantRim'] },
  F3: { box: '-5 -7 82 49', parts: ['bookLeft', 'bookRight', 'bookCover', 'bookLines', 'bookmark'] },
  F4: { box: '-8 -9 54 43', parts: ['saucer', 'cup', 'cupTea'] },
  F5: { box: '-15 -14 31 30', parts: ['bubble', 'bubbleShine'] },
  F6: { box: '-4 -28 76 53', parts: ['boat', 'boatStripe'] },
  F7: { box: '-4 -7 32 33', parts: ['blockGold'] },
  F8: { box: '-14 -15 28 29', parts: ['star'] },
}
const tagIds = Object.keys(sketches) as FocusSceneId[]
function Sketch({ id }: { id: FocusSceneId }) {
  const { box, parts } = sketches[id]
  return <svg viewBox={box} className="room-sketch" aria-hidden="true" focusable="false">
    {parts.map(name => <ScenePart key={name} name={name}/>)}
  </svg>
}

/** A shallow ledge in the same wood as the table. Its front lip overlaps the paper. */
function BookLedge() {
  return <svg className="room-ledge" viewBox="0 0 250 16" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path className="ledge-shadow" d="M11 9Q112 8 240 7L235 13Q124 17 14 14Z"/>
    <path className="ledge-top" d="M8 3Q127 1.5 241 2L246 5.5Q129 8 4 6Z"/>
    <path className="ledge-edge" d="M4 6Q129 8 246 5.5L244 9Q135 12 6 10Z"/>
    <path className="ledge-grain" d="M15 7.5L42 8M79 4.2Q96 3.5 111 4M165 8.3L188 7.8M207 3.6L230 3.4"/>
  </svg>
}

interface RoomInfo {
  band: RecordsBand
  activities: ReadonlyMap<FocusSceneId, readonly unknown[]>
}
interface PictureProps extends RoomInfo {
  selected?: FocusSceneId | null
  onSelect?: (id: FocusSceneId, trigger: HTMLButtonElement) => void
}
function RoomPicture({ band, activities, selected, onSelect }: PictureProps) {
  const ids = tagIds.filter(id => activities.has(id))
  return <span className="room-picture" data-band={band}>
    <RecordsGreetingArt band={band}/>
    {ids.length > 0 && <span className="room-shelf">{[ids.slice(0, 4), ids.slice(4)].filter(row => row.length > 0).map(row =>
      <span className="room-shelf-row" key={row[0]}>{row.map(id => onSelect
      ? <button key={id} type="button" data-room-spot={id} aria-label={`${sceneNames[id]}，查看 ${activities.get(id)!.length} 段专注`}
          aria-pressed={selected === id} onClick={event => onSelect(id, event.currentTarget)}><span className="room-ticket"><Sketch id={id}/></span></button>
      : <span key={id} className="room-sample"><span className="room-ticket"><Sketch id={id}/></span></span>)}
        <BookLedge/>
      </span>)}</span>}
  </span>
}

export function RoomPreview({ band, activities, showArt, onOpen }: RoomInfo & { showArt: boolean; onOpen: () => void }) {
  return <button type="button" className="room-preview" onClick={onOpen}>
    <span>查看窗边的小屋 <span aria-hidden="true">›</span></span>
    {showArt && <span className="room-thumbnail" aria-hidden="true"><RoomPicture band={band} activities={activities}/></span>}
  </button>
}

export function RecordsRoom({ band, activities, selected, onSelect, incomplete }: Required<PictureProps> & { incomplete: boolean }) {
  return <section className="records-room" aria-label="窗边的小屋">
    <h3 tabIndex={-1}>窗边的小屋</h3>
    <RoomPicture band={band} activities={activities} selected={selected} onSelect={onSelect}/>
    <p className="room-directions">{activities.size
      ? '架上的画签对应已保存的伙伴活动。点一枚，就能找到那几段专注。'
      : incomplete ? '目前没有能确认来源的画签。' : '窗边是小屋原来的布景。有了带伙伴活动的专注记录，架上就会出现对应的画签。'}</p>
    {activities.size > 0 && <div className="room-tag-list" role="group" aria-label="按活动找记录">
      {tagIds.filter(id => activities.has(id)).map(id => <button type="button" key={id} data-room-label={id}
        aria-pressed={selected === id} onClick={event => onSelect(id, event.currentTarget)}>{sceneNames[id]} · {activities.get(id)!.length} 段</button>)}
    </div>}
  </section>
}
