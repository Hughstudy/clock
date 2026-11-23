import { listWindow, type Page } from '../../../hooks/records/book-data'
import type { Detail } from '../../../hooks/records/book-navigation'
import type { RecordsProps } from './props'
import { PagePicture, Facts } from './BookPaper'
import { formatMinutes } from '../../format'

export function BookMemory({
  p,
  props,
  openDetail,
}: {
  p: Page
  props: RecordsProps
  openDetail: (detail: Detail) => void
}) {
  const { showArt } = props
  return (
    <article
      className="jl-memory-leaf"
      data-record-id={p.record?.sessionId}
      data-rest-id={p.record ? undefined : p.id.slice(5)}
      data-saved={p.record?.saved ?? true}
    >
      <header className="jl-date">
        <span>{p.day}</span>
        <span className="jl-day-rule" />
        <span className="jl-day-time">{p.time}</span>
      </header>
      <PagePicture p={p} showArt={showArt} />
      <div className="jl-story-words">
        <h2 className="jl-story-title">{p.title}</h2>
        {p.caption && <p className="jl-caption">{p.caption}</p>}
      </div>
      <Facts p={p} showArt={showArt} />
      {p.record && (
        <div className="jl-record-metadata">
          {p.record.step && <p>这一小步：{p.record.step}</p>}
          <p>
            {p.record.initialDurationMs !== undefined && p.record.initialDurationMs !== p.record.targetMs
              ? `原计划 ${formatMinutes(p.record.initialDurationMs)} · 调整后 `
              : '目标 '}
            {formatMinutes(p.record.targetMs)} ·{' '}
            {p.record.saved ? '已保存' : props.persistence === 'memory-only' ? '仅在此页' : '待保存'}
          </p>
          {listWindow(p.record.thoughts, 1).items.map((n) => (
            <button
              type="button"
              className="jl-row"
              data-jl-note={n.id}
              key={n.id}
              onClick={() => openDetail({ kind: 'note', id: n.id })}
            >
              <span>{n.text || '留过标记'}</span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
          {listWindow(p.record.thoughts, 1).count > 1 && (
            <button
              type="button"
              className="link-button"
              data-jl-linked
              onClick={() => openDetail({ kind: 'linked', id: p.record!.sessionId })}
            >
              查看全部 {p.record.thoughts.length} 条想法
            </button>
          )}
        </div>
      )}
    </article>
  )
}
