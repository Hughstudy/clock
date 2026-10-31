import { useId } from 'react'
import type { Persistence } from '../adapters/storage'
import { recordStories } from '../data/record-stories'
import type { RecordView } from '../hooks/useViews'
import { RecordStoryArt } from './companion/RecordsArt'
import { formatMinutes } from './format'

interface Props {
  record: RecordView
  expanded: boolean
  onToggle: () => void
  persistence: Persistence
  showArt: boolean
  confirmedThoughtIds: ReadonlySet<string>
  editThought?: ((id: string) => void) | undefined
}

export function RecordEntry({ record, expanded, onToggle, persistence, showArt, confirmedThoughtIds, editThought }: Props) {
  const detailId = useId()
  const { storyId } = record
  const story = storyId ? recordStories[storyId] : null
  const pendingText = persistence === 'memory-only' ? '仅在此页' : persistence === 'read-only' ? '尚未保存（只读）' : '待保存'
  return (
    <li data-record-id={record.sessionId} data-saved={storyId !== null} data-story-id={storyId ?? undefined}>
      <button className="record-summary" type="button" aria-expanded={expanded} aria-controls={detailId} onClick={onToggle}>
        <span className="record-identity">
          <span className="record-meta"><time dateTime={record.dateKey}>{record.dateKey}</time> · {story ? '已保存' : pendingText}</span>
          <strong>{record.elapsedMs === 0 ? '已开始过这一段' : formatMinutes(record.elapsedMs)}</strong>
          {record.step && <span className="record-step">这一小步：{record.step}</span>}
          {record.thoughts.length > 0 && <span className="record-meta">{record.thoughts.some(t => t.text) ? '留有想法' : '留过标记'}</span>}
        </span>
        {showArt && storyId && <RecordStoryArt storyId={storyId} compact />}
        <svg className="record-chevron" aria-hidden="true" viewBox="0 0 16 16"><path d="m3 6 5 5 5-5" /></svg>
      </button>
      <div id={detailId} className="record-detail" hidden={!expanded}>
        {expanded && <>
          <p>{record.endReason === 'manual' ? '手动结束' : '到时结束'} · 目标 {formatMinutes(record.targetMs)}</p>
          {record.thoughts.length > 0 && <ul className="record-thoughts" aria-label="这一段的想法">
            {record.thoughts.map(t => <li key={t.id}>
              <time dateTime={new Date(t.createdAt).toISOString()}>{t.dateKey}</time> · {t.text || '留过标记'}{!confirmedThoughtIds.has(t.id) && ' · ' + pendingText}
              {editThought && <button type="button" className="link-button" onClick={() => editThought(t.id)}>{t.text ? '编辑文字' : '补充文字'}</button>}
            </li>)}
          </ul>}
          {story && storyId && <figure className="record-story" data-story-id={storyId}>
            {showArt && <RecordStoryArt storyId={storyId} />}
            <figcaption><small>伙伴的小故事</small><strong>{story.title}</strong><p>{story.caption}</p></figcaption>
          </figure>}
        </>}
      </div>
    </li>
  )
}
