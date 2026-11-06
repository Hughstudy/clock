import { useId } from 'react'
import type { Persistence } from '../../adapters/storage'
import { formatMinutes } from '../format'
import type { Thoughts } from '../../hooks/useThoughts'
import type { StatsView } from '../../hooks/useViews'
import type { Thought } from '../../logic/types'

export function ThoughtEntry({ item, expanded, toggle, view, persistence, canEdit, thoughts, edit }: {
  item: Thought; expanded: boolean; toggle: () => void; view: StatsView; persistence: Persistence
  canEdit: boolean; thoughts: Thoughts; edit: ((id: string) => void) | undefined
}) {
  const detailId = useId()
  const linkedRecord = item.sessionId ? view.recordBySession.get(item.sessionId) : undefined
  const pending = view.pendingThoughtIds.has(item.id)
  const originalPending = !view.confirmedThoughtIds.has(item.id)
  return <li data-thought-id={item.id} data-entry-id={`thought:${item.id}`}>
    <button type="button" className="record-summary" aria-expanded={expanded} aria-controls={detailId} onClick={toggle}>
      <span className="record-identity">
        <span className="record-meta">{view.clockTime(item.createdAt)} · {item.text ? '想法' : '标记'}{item.status === 'putAway' ? ' · 已收起' : ''}
          {originalPending ? persistence === 'memory-only' ? ' · 仅在此页' : ' · 待保存' : pending ? ' · 有更改待保存' : ''}</span>
        <strong className="thought-preview">{item.text || '留过标记'}</strong>
      </span><span aria-hidden="true">{expanded ? '−' : '＋'}</span>
    </button>
    {!item.text && edit && !expanded && <button type="button" className="link-button records-add-text" disabled={!canEdit || pending} onClick={() => edit(item.id)}>补充文字</button>}
    <div id={detailId} className="record-detail" hidden={!expanded}>
      {expanded && <>
        {item.text && <p className="thought-body">{item.text}</p>}
        {linkedRecord && <p>关联专注 · {view.shortDate(linkedRecord.dateKey)} {linkedRecord.timeLabel} · {formatMinutes(linkedRecord.elapsedMs)}{linkedRecord.step && ' · ' + linkedRecord.step}</p>}
        {item.sessionId && item.sessionId === view.active?.id && <p>关联当前专注</p>}
        <div className="thought-row-actions">
          {edit && <button type="button" className="link-button" disabled={!canEdit || pending} onClick={() => edit(item.id)}>{item.text ? '编辑文字' : '补充文字'}</button>}
          <button type="button" className="link-button" disabled={!canEdit || pending} onClick={() => item.status === 'open' ? thoughts.putAway(item.id) : thoughts.reopen(item.id)}>{item.status === 'open' ? '收起想法' : '放回待看'}</button>
          <button type="button" className="link-button" disabled={!canEdit || pending} onClick={() => thoughts.remove(item.id)}>删除这条想法</button>
        </div>
        {pending && <p className="hint">这条想法有更改待保存。<button type="button" className="link-button" onClick={thoughts.retry}>重试保存</button></p>}
      </>}
    </div>
  </li>
}
