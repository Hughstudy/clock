import { sceneNames } from '../../data/scene-copy'
import type { RecordsBand } from '../../logic/record-stories'
import type { SceneId } from '../../logic/types'
import { RecordsGreetingArt } from '../companion/RecordsArt'
import { RoomPreview } from '../RecordsRoom'
import { MemoryStamp } from './MemoryPaper'

interface Props {
  featured: { id: string; picture: SceneId; date: string; phase: string } | null
  activities: ReadonlyMap<SceneId, readonly unknown[]>
  page: number
  band: RecordsBand
  showArt: boolean
  onRead: (id: string) => void
  onRoom: () => void
}

/** Feature a picture from this page so one tap opens its original in the current history. */
export function MemoryAlbum({ featured, activities, page, band, showArt, onRead, onRoom }: Props) {
  return <section className="memory-album album-paper" aria-label="窗边手记">
    {featured ? <button type="button" className="memory-postcard album-paper-surface" data-featured-id={featured.id}
      aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll: true }); onRead(featured.id) }}>
      <span className="memory-postcard-copy">
        <span className="memory-kicker">{page === 1 ? '最近的画签' : '这一页的画签'}</span>
        <strong>{sceneNames[featured.picture]}</strong>
        <span className="memory-caption">{featured.date} · {featured.phase}</span>
        <span className="memory-read">翻开手记 <span aria-hidden="true">›</span></span>
      </span>
      {showArt && <span className="postcard-art" aria-hidden="true"><MemoryStamp id={featured.picture}/><span className="postmark"/></span>}
    </button> : <div className="memory-intro album-paper-surface">
      {showArt && <span className="memory-room-print"><RecordsGreetingArt band={band}/></span>}
      <div><h2>窗边手记</h2><p>专注时的小事、休息时的片刻，会在这里留下一张张画签。</p></div>
    </div>}
    <RoomPreview band={band} activities={activities} showArt={showArt && !!featured} onOpen={onRoom}/>
  </section>
}
