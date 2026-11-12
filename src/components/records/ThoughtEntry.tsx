import type { Persistence } from '../../adapters/storage'
import { ThoughtPaper } from './ThoughtNotebook'
import { MemoryChevron, MemoryDetailSheet } from './MemoryPaper'
import { formatMinutes } from '../format'
import type { Thoughts } from '../../hooks/useThoughts'
import type { StatsView } from '../../hooks/useViews'
import type { Thought } from '../../logic/types'

interface ThoughtProps {
  item: Thought
  view: StatsView
  persistence: Persistence
  canEdit: boolean
  edit: ((id: string) => void) | undefined
}

function thoughtMeta(item: Thought, view: StatsView, persistence: Persistence) {
  const status = !view.confirmedThoughtIds.has(item.id) ? persistence === 'memory-only' ? ' · 仅在此页' : ' · 待保存'
    : view.pendingThoughtIds.has(item.id) ? ' · 有更改待保存' : ''
  return `${view.clockTime(item.createdAt)} · ${item.text ? '想法' : '标记'}${item.status === 'putAway' ? ' · 已收起' : ''}${status}`
}

export function ThoughtEntry({ item, expanded, toggle, view, persistence, canEdit, edit, notebook, illustrated }: ThoughtProps & {
  expanded: boolean; toggle: () => void; notebook: boolean; illustrated: boolean
}) {
  const showAddText = !item.text && !!edit
  return <li className={notebook && showAddText ? 'notebook-marker-row' : undefined} data-thought-id={item.id} data-entry-id={`thought:${item.id}`}>
    <button type="button" className="record-summary" aria-expanded={expanded} aria-haspopup="dialog" onClick={event => {
      event.currentTarget.focus({ preventScroll: true }); toggle()
    }}>
      {notebook && illustrated && <ThoughtPaper kind={item.text ? 'note' : 'marker'}/>}
      <span className="record-identity">
        <span className="record-meta">{thoughtMeta(item, view, persistence)}</span>
        <strong className="thought-preview">{item.text || '留过标记'}</strong>
      </span><MemoryChevron/>
    </button>
    {showAddText && <button type="button" className="link-button records-add-text" aria-haspopup="dialog" disabled={!canEdit || view.pendingThoughtIds.has(item.id)} onClick={event => {
      event.currentTarget.focus({ preventScroll: true }); edit(item.id)
    }}>补充文字</button>}
  </li>
}

export function ThoughtDetail({ item, view, persistence, canEdit, edit, thoughts, detached, onClose, onRemove, returningFromEdit }: ThoughtProps & {
  thoughts: Thoughts; detached: boolean; onClose: () => void; onRemove: () => void; returningFromEdit: boolean
}) {
  const linkedRecord = item.sessionId ? view.recordBySession.get(item.sessionId) : undefined
  const pending = view.pendingThoughtIds.has(item.id)
  return <MemoryDetailSheet title={item.text ? '想法' : '标记'} onClose={onClose}>
    <div className={detached ? 'record-detail records-detached' : 'record-detail'}>
      <p className="record-meta">{view.shortDate(item.dateKey)} · {thoughtMeta(item, view, persistence)}</p>
      <p className="thought-body">{item.text || '留过标记'}</p>
      {linkedRecord && <p>关联专注 · {view.shortDate(linkedRecord.dateKey)} {linkedRecord.timeLabel} · {formatMinutes(linkedRecord.elapsedMs)}{linkedRecord.step && ' · ' + linkedRecord.step}</p>}
      {item.sessionId && item.sessionId === view.active?.id && <p>关联当前专注</p>}
      {detached && <p className="hint">这条想法已不符合当前查找条件，关闭后返回原结果。</p>}
      <div className="thought-row-actions">
        {edit && <button type="button" className="link-button" data-initial-focus={returningFromEdit || undefined} disabled={!canEdit || pending} onClick={() => edit(item.id)}>{item.text ? '编辑文字' : '补充文字'}</button>}
        <button type="button" className="link-button" disabled={!canEdit || pending} onClick={() => item.status === 'open' ? thoughts.putAway(item.id) : thoughts.reopen(item.id)}>{item.status === 'open' ? '收起想法' : '放回待看'}</button>
        <button type="button" className="link-button" disabled={!canEdit || pending} onClick={onRemove}>删除这条想法</button>
      </div>
      {pending && <p className="hint">这条想法有更改待保存。<button type="button" className="link-button" onClick={thoughts.retry}>重试保存</button></p>}
    </div>
  </MemoryDetailSheet>
}
