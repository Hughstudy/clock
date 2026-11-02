import { useId } from 'react'
import type { Persistence } from '../adapters/storage'
import { sceneNames } from '../data/scene-copy'
import type { RecordView } from '../hooks/useViews'
import { CompanionSceneArt } from './companion/CompanionSceneArt'
import { formatMinutes } from './format'

interface Props {
  record: RecordView
  expanded: boolean
  onToggle: () => void
  persistence: Persistence
  showArt: boolean
  confirmedThoughtIds: ReadonlySet<string>
  editThought?: ((id: string) => void) | undefined
  /** `10月24日`: shown beside a thought written on another day than its session's. */
  formatDate: (key: string) => string
  pendingThoughtIds?: ReadonlySet<string>
}

export function RecordEntry({ record, expanded, onToggle, persistence, showArt, confirmedThoughtIds, editThought, formatDate, pendingThoughtIds }: Props) {
  const detailId = useId()
  const scene = record.saved ? record.scene : undefined
  const pendingText = persistence === 'memory-only' ? '仅在此页' : persistence === 'read-only' ? '尚未保存（只读）' : '待保存'
  return (
    <li data-record-id={record.sessionId} data-entry-id={`record:${record.sessionId}`} data-saved={record.saved}>
      <button className="record-summary" type="button" aria-expanded={expanded} aria-controls={detailId} onClick={onToggle}>
        <span className="record-identity">
          <span className="record-meta">{record.timeLabel}{record.saved ? '' : ' · ' + pendingText}</span>
          <strong>{record.elapsedMs === 0 ? '已开始过这一段' : formatMinutes(record.elapsedMs)}</strong>
          {record.step && <span className="record-step">这一小步：{record.step}</span>}
          {record.thoughts.length > 0 && <span className="record-meta">{record.thoughts.some(t => t.text) ? '留有想法' : '留过标记'}</span>}
          {scene && <span className="record-meta">伙伴活动 · {sceneNames[scene.sceneId]}</span>}
        </span>
        <svg className="record-chevron" aria-hidden="true" viewBox="0 0 16 16"><path d="m3 6 5 5 5-5" /></svg>
      </button>
      <div id={detailId} className="record-detail" hidden={!expanded}>
        {expanded && <>
          <p>{record.endReason === 'manual' ? '手动结束' : '到时结束'} · 目标 {formatMinutes(record.targetMs)} · {record.saved ? '已保存' : pendingText}</p>
          {record.thoughts.length > 0 && <ul className="record-thoughts" aria-label="这一段的想法">
            {record.thoughts.map(t => <li key={t.id}>
              {t.dateKey !== record.dateKey && `${formatDate(t.dateKey)} · `}{t.text || '留过标记'}{!confirmedThoughtIds.has(t.id) && ' · ' + pendingText}{pendingThoughtIds?.has(t.id) && ' · 有更改待保存'}
              {editThought && <button type="button" className="link-button" onClick={() => editThought(t.id)}>{t.text ? '编辑文字' : '补充文字'}</button>}
            </li>)}
          </ul>}
          {scene && <figure className="record-story" data-scene-id={scene.sceneId}>
            {showArt && <svg className="blue-companion records-scene-preview" data-static="true" viewBox="0 0 240 180" aria-hidden="true" focusable="false">
              <CompanionSceneArt scene={{ key: record.sessionId, id: scene.sceneId, sessionId: record.sessionId,
                phase: 'focus', status: 'ended', completedProgress: record.sceneProgress,
                allowBeats: false, cue: null, ending: null }} />
            </svg>}
            <figcaption><small>这一段的伙伴活动</small><strong>{sceneNames[scene.sceneId]}</strong><p>本段计时 {formatMinutes(record.elapsedMs)}。活动画面按已记录的进度呈现。</p></figcaption>
          </figure>}
        </>}
      </div>
    </li>
  )
}
