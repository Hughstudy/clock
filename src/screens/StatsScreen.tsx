import { memo, useLayoutEffect, useRef, useState } from 'react'
import type { Persistence, StoreNotice } from '../adapters/storage'
import { RecordsGreetingArt } from '../components/companion/RecordsArt'
import { formatMinutes } from '../components/format'
import { RecordEntry } from '../components/RecordEntry'
import { WeekChart } from '../components/WeekChart'
import { recordsGreeting } from '../data/record-stories'
import { useRecordsEntrance } from '../hooks/companion/useRecordsEntrance'
import type { Thoughts } from '../hooks/useThoughts'
import type { StatsView } from '../hooks/useViews'

interface Props {
  view: StatsView
  thoughts: Thoughts
  canEdit: boolean
  persistence: Persistence
  notice: StoreNotice | null
  hasSaveError: boolean
  showArt: boolean
  reducedMotion: boolean
}

const thoughtText = (text: string) => text || '（一个标记）'

const RecordHistory = memo(function RecordHistory({ records, persistence, showArt, incomplete }: {
  records: StatsView['records']
  persistence: Persistence
  showArt: boolean
  incomplete: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const list = useRef<HTMLOListElement>(null)
  useLayoutEffect(() => {
    // Closing a tall entry above the next one can move the button out of view.
    if (expandedId) list.current?.querySelector('button[aria-expanded="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [expandedId])
  return (
    <section className="card focus-history">
      <h3 className="card-title">留下的每一段</h3>
      {records.length === 0 ? <p>{incomplete ? '暂时无法确认之前的记录。' : '结束一段专注后，就能在这里翻开它的小故事。'}</p> : (
        <ol className="focus-records" ref={list}>
          {records.map(record => <RecordEntry key={record.sessionId} record={record}
            expanded={expandedId === record.sessionId} showArt={showArt} persistence={persistence}
            onToggle={() => setExpandedId(current => current === record.sessionId ? null : record.sessionId)} />)}
        </ol>
      )}
    </section>
  )
})

export function StatsScreen({ view, thoughts, canEdit, persistence, notice, hasSaveError, showArt, reducedMotion }: Props) {
  const { today, week } = view
  const incomplete = notice?.kind === 'unreadable' || notice?.kind === 'unavailable' ||
    (notice?.kind === 'repaired' && notice.fields.some(field => field.startsWith('records')))
  const animate = useRecordsEntrance(view.band, showArt && !reducedMotion && !hasSaveError && !incomplete && notice?.kind !== 'removed')
  return (
    <section className="screen stats" aria-labelledby="stats-title">
      <header className="records-greeting" data-band={view.band} data-animate={animate}>
        <div><h2 id="stats-title" className="screen-title">记录</h2>
          {showArt && <p>{recordsGreeting[view.band]}</p>}
        </div>
        {showArt && <RecordsGreetingArt band={view.band} animate={animate} />}
      </header>
      {incomplete && <p className="hint">历史数据未能完整读取。这里只展示当前能确认的内容。</p>}
      {!incomplete && <>
        <div className="stat-grid">
          <div className="stat"><p className="stat-label">今天的时长</p><p className="stat-value">{formatMinutes(today.focusMs)}</p><p className="stat-detail">{today.count} 段</p></div>
          <div className="stat"><p className="stat-label">本周的时长</p><p className="stat-value">{formatMinutes(week.focusMs)}</p><p className="stat-detail">{week.count} 段</p></div>
        </div>
        <p className="hint">累计开启过 {view.participationCount} 段专注。当前计时中的时长在结束后计入。</p>
        <details className="card"><summary className="card-title">查看本周投入</summary><WeekChart days={week.days} todayKey={view.todayKey} firstWeekday={view.firstWeekday} /></details>
      </>}
      <RecordHistory records={view.records} persistence={persistence} showArt={showArt} incomplete={incomplete} />
      <div className="card thought-list">
        <h3 className="card-title">想法</h3>
        {view.thoughts.length === 0 ? <p>计时中随手记下的想法，会放在这里。</p> : (
          <ul className="thoughts">
            {view.thoughts.map((t) => (
              <li key={t.id} data-status={t.status}>
                <p>{thoughtText(t.text)}</p>
                <span className="thought-meta">{t.dateKey}{t.sessionId ? ' · 计时中记下' : ''}{t.status === 'putAway' ? ' · 已收起' : ''}</span>
                <div className="thought-row-actions">
                  {t.status === 'open'
                    ? <button type="button" className="link-button" disabled={!canEdit} onClick={() => thoughts.putAway(t.id)}>收起</button>
                    : <button type="button" className="link-button" disabled={!canEdit} onClick={() => thoughts.reopen(t.id)}>放回待看</button>}
                  <button type="button" className="link-button" disabled={!canEdit} onClick={() => thoughts.remove(t.id)}>删除</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(thoughts.status || thoughts.undo) && (
          <p className={`thought-status${thoughts.status?.kind === 'error' ? ' thought-status--error' : ''}`}>
            {thoughts.status?.text}
            {thoughts.undo && <button type="button" className="link-button" disabled={!canEdit} onClick={thoughts.undo.run}>{thoughts.undo.label}</button>}
          </p>
        )}
      </div>
    </section>
  )
}
