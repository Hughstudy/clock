import { sceneNames } from '../data/scene-copy'
import type { RecordsBand } from '../logic/record-stories'
import type { SceneId } from '../logic/types'
import { MemorySketch, MemoryStamp } from './records/MemoryStamp'
import { MemoryChevron } from './records/MemoryPaper'
import { RecordsGreetingArt } from './companion/RecordsArt'
import '../styles/records-room.css'

export { MemorySketch } from './records/MemoryStamp'

const tagIds = Object.keys(sceneNames) as SceneId[]
const lightLabels: Record<RecordsBand, string> = { morning: '晨光', afternoon: '午后', evening: '夕照', night: '夜色' }

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
  activities: ReadonlyMap<SceneId, readonly unknown[]>
}
interface PictureProps extends RoomInfo {
  selected?: SceneId | null
  onSelect?: (id: SceneId, trigger: HTMLButtonElement) => void
}
function RoomPicture({ band, activities, selected, onSelect }: PictureProps) {
  const ids = tagIds.filter(id => activities.has(id))
  const shelves = Array.from({ length: Math.ceil(ids.length / 4) }, (_, i) => ids.slice(i * 4, (i + 1) * 4))
  return <span className="room-picture" data-band={band}>
    <RecordsGreetingArt band={band}/>
    {ids.length > 0 && <span className="room-shelf">{shelves.map(row =>
      <span className="room-shelf-row" key={row[0]}>{row.map(id => onSelect
      ? <button key={id} type="button" data-room-spot={id} aria-label={`${sceneNames[id]}，查看 ${activities.get(id)!.length} 段${id.startsWith('R') ? '休息' : '专注'}`}
          aria-haspopup="dialog" aria-expanded={selected === id} onClick={event => onSelect(id, event.currentTarget)}><MemoryStamp id={id}/></button>
      : <span key={id} className="room-sample"><span className="room-ticket"><MemorySketch id={id}/></span></span>)}
        <BookLedge/>
      </span>)}</span>}
  </span>
}

export function RoomPreview({ band, activities, showArt, onOpen }: RoomInfo & { showArt: boolean; onOpen: () => void }) {
  return <button type="button" className="room-preview" onClick={onOpen}>
    {showArt && <span className="room-thumbnail" aria-hidden="true"><RoomPicture band={band} activities={activities}/></span>}
    <span className="room-preview-title">查看窗边的小屋</span>
    <span className="room-preview-chevron" aria-hidden="true">›</span>
  </button>
}

export function RecordsRoom({ band, activities, selected, onSelect, incomplete }: Required<PictureProps> & { incomplete: boolean }) {
  return <section className="records-room" aria-label="窗边的小屋">
    <div className="room-album-card album-paper album-paper-surface">
      <header className="room-album-header">
        <h3 tabIndex={-1}>窗边的小屋</h3>
        <span>{lightLabels[band]}</span>
      </header>
      <div className="room-photo-mount">
        <RoomPicture band={band} activities={activities} selected={selected} onSelect={onSelect}/>
      </div>
      <p className="room-directions">{activities.size
        ? '点一张画签，翻看它出现过的日子。'
        : incomplete ? '目前没有能确认来源的画签。' : '专注和休息时的画签，会收在窗边。'}</p>
    </div>
    {activities.size > 0 && <div className="room-index" role="group" aria-label="按活动找记录">
      {(['F', 'R'] as const).map(prefix => {
        const ids = tagIds.filter(id => id.startsWith(prefix) && activities.has(id))
        if (!ids.length) return null
        const label = prefix === 'F' ? '专注' : '休息'
        return <section className="room-index-group" key={prefix} aria-label={label + '画签'}>
          <h4>{label}画签</h4>
          <ul className="room-index-list">{ids.map(id => <li key={id}>
            <button type="button" data-room-label={id} aria-haspopup="dialog" aria-expanded={selected === id} onClick={event => onSelect(id, event.currentTarget)}>
              <MemoryStamp id={id}/><strong>{sceneNames[id]}</strong>
              <span className="room-entry-count">{activities.get(id)!.length} 段</span><MemoryChevron/>
            </button>
          </li>)}</ul>
        </section>
      })}
    </div>}
  </section>
}
