import { useId } from 'react'
import type { Persistence } from '../adapters/storage'
import { sceneNames } from '../data/scene-copy'
import type { RecordView } from '../hooks/useViews'
import { CompanionSceneArt } from './companion/CompanionSceneArt'
import { formatMinutes } from './format'
import { MemoryChevron, MemoryDetailSheet, MemoryStamp } from './records/MemoryPaper'

interface Props {
  record: RecordView
  expanded: boolean
  onToggle: () => void
  inline?: boolean
  persistence: Persistence
  showArt: boolean
  confirmedThoughtIds: ReadonlySet<string>
  editThought?: ((id: string) => void) | undefined
  formatDate: (key: string) => string
  pendingThoughtIds?: ReadonlySet<string>
}

export function RecordEntry({ record, expanded, onToggle, inline, persistence, showArt, confirmedThoughtIds, editThought, formatDate, pendingThoughtIds }: Props) {
  const detailId = useId()
  const scene = record.saved ? record.scene : undefined
  const length = formatMinutes(record.elapsedMs)
  const name = scene ? sceneNames[scene.sceneId] : '一段专注'
  const pendingText = persistence === 'memory-only' ? '仅在此页' : persistence === 'read-only' ? '尚未保存（只读）' : '待保存'
  const detail = expanded && <div id={detailId} className="record-detail memory-detail">
    {scene && <figure className="record-story" data-scene-id={scene.sceneId}>
      {showArt && <svg className="blue-companion records-scene-preview" data-static="true" viewBox="0 0 240 180" aria-hidden="true" focusable="false">
        <CompanionSceneArt scene={{ key: record.sessionId, id: scene.sceneId, sessionId: record.sessionId,
          phase: 'focus', status: 'ended', completedProgress: record.sceneProgress, allowBeats: false, cue: null, ending: null }} />
      </svg>}
      <figcaption><small>这一段的伙伴活动</small><strong>{name}</strong></figcaption>
    </figure>}
    {record.step && <p className="memory-step">这一小步：{record.step}</p>}
    <p>{formatDate(record.dateKey)} · {record.timeLabel}</p>
    <p>专注 {length} · {record.endReason === 'manual' ? '手动结束' : '到时结束'} · 目标 {formatMinutes(record.targetMs)} · {record.saved ? '已保存' : pendingText}</p>
    {record.thoughts.length > 0 && <ul className="record-thoughts" aria-label="这一段的想法">
      {record.thoughts.map(t => <li key={t.id}>
        {t.dateKey !== record.dateKey && `${formatDate(t.dateKey)} · `}{t.text || '留过标记'}{!confirmedThoughtIds.has(t.id) && ' · ' + pendingText}{pendingThoughtIds?.has(t.id) && ' · 有更改待保存'}
        {editThought && <button type="button" className="link-button" onClick={() => {
          if (!inline) onToggle()
          editThought(t.id)
        }}>{t.text ? '编辑文字' : '补充文字'}</button>}
      </li>)}
    </ul>}
  </div>
  return <li data-record-id={record.sessionId} data-entry-id={`record:${record.sessionId}`} data-saved={record.saved}>
    <button className="record-summary" type="button" aria-expanded={expanded} aria-controls={expanded ? detailId : undefined}
      aria-haspopup={inline ? undefined : 'dialog'} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onToggle() }}>
      {showArt && scene && <MemoryStamp id={scene.sceneId}/>}
      <span className="record-identity">
        <strong>{record.step || name}</strong>
        {scene && record.step && <span className="record-meta">伙伴活动 · {name}</span>}
        <span className="record-meta">专注 · {record.elapsedMs === 0 ? '已开始过这一段' : length} · {record.timeLabel}{!record.saved && ' · ' + pendingText}</span>
        {record.thoughts.length > 0 && <span className="record-meta">{record.thoughts.some(t => t.text) ? '留有想法' : '留过标记'}</span>}
      </span><MemoryChevron/>
    </button>
    {expanded && (inline ? detail : <MemoryDetailSheet title="专注手记" onClose={onToggle}>{detail}</MemoryDetailSheet>)}
  </li>
}
