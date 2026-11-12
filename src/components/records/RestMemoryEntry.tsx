import { useId } from 'react'
import { sceneNames } from '../../data/scene-copy'
import type { StatsView } from '../../hooks/useViews'
import type { RestMemory } from '../../logic/types'
import { formatMinutes, PHASE_LABELS } from '../format'
import { MemoryChevron, MemoryDetailSheet, MemoryStamp } from './MemoryPaper'

interface Props {
  memory: RestMemory
  expanded: boolean
  onToggle: () => void
  inline?: boolean
  showArt: boolean
  view: StatsView
}

export function RestMemoryEntry({ memory, expanded, onToggle, inline, showArt, view }: Props) {
  const detailId = useId()
  const title = memory.sceneId ? sceneNames[memory.sceneId] : '一段休息'
  const phase = memory.phase ? PHASE_LABELS[memory.phase] : '休息'
  const date = memory.dateKey ? view.shortDate(memory.dateKey) : '日期不详'
  const length = formatMinutes(memory.elapsedMs)
  const detail = <div id={detailId} className="record-detail memory-detail">
    <div className="memory-page" data-scene-id={memory.sceneId}>
      {showArt && memory.sceneId && <MemoryStamp id={memory.sceneId}/>}
      <div><span className="record-meta">{memory.sceneId ? '这一段的伙伴活动' : '休息记录'}</span><h3>{title}</h3></div>
    </div>
    <p>{date} · {view.clockTime(memory.endedAt)} 结束</p>
    <p>{phase} · {length}{memory.endReason && (memory.endReason === 'manual' ? ' · 手动结束' : ' · 到时结束')} · 已保存</p>
  </div>
  return <li data-rest-id={memory.sessionId} data-entry-id={`rest:${memory.sessionId}`}>
    <button className="record-summary" type="button" aria-expanded={expanded} aria-haspopup={inline ? undefined : 'dialog'}
      aria-controls={expanded ? detailId : undefined} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onToggle() }}>
      {showArt && memory.sceneId && <MemoryStamp id={memory.sceneId}/>}
      <span className="record-identity"><strong>{title}</strong>
        <span className="record-meta">{phase} · {length} · {view.clockTime(memory.endedAt)} 结束</span></span>
      <MemoryChevron/>
    </button>
    {expanded && (inline ? detail : <MemoryDetailSheet title="休息手记" onClose={onToggle}>{detail}</MemoryDetailSheet>)}
  </li>
}
