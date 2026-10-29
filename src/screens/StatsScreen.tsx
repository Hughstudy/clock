import { formatMinutes } from '../components/format'
import { WeekChart } from '../components/WeekChart'
import type { Thoughts } from '../hooks/useThoughts'
import type { StatsView } from '../hooks/useViews'

interface Props {
  view: StatsView
  thoughts: Thoughts
  canEdit: boolean
}

const thoughtText = (text: string) => text || '（一个标记）'

export function StatsScreen({ view, thoughts, canEdit }: Props) {
  const { today, week } = view
  return (
    <section className="screen stats" aria-labelledby="stats-title">
      <h2 id="stats-title" className="screen-title">记录</h2>
      <div className="stat-grid">
        <div className="stat"><p className="stat-label">今天已记录</p><p className="stat-value">{formatMinutes(today.focusMs)}</p><p className="stat-detail">{today.count} 段</p></div>
        <div className="stat"><p className="stat-label">本周已记录</p><p className="stat-value">{formatMinutes(week.focusMs)}</p><p className="stat-detail">{week.count} 段</p></div>
      </div>
      <p className="hint">累计开启过 {view.participationCount} 段专注。当前计时中的时长在结束后计入。</p>
      <details className="card"><summary className="card-title">查看本周投入</summary><WeekChart days={week.days} todayKey={view.todayKey} firstWeekday={view.firstWeekday} /></details>
      <div className="card focus-history">
        <h3 className="card-title">留下的每一段</h3>
        {view.records.length === 0 ? <p>结束一段专注后，可以在这里回看。</p> : (
          <ol className="focus-records">
            {view.records.map((record) => (
              <li key={record.sessionId}>
                <time>{record.dateKey}</time>
                <strong>{record.elapsedMs === 0 ? '已开始过这一段' : formatMinutes(record.elapsedMs)}</strong>
                {record.step && <span className="record-step">这一小步：{record.step}</span>}
                <span>{record.endReason === 'manual' ? '手动结束' : '到时结束'} · 目标 {formatMinutes(record.targetMs)}</span>
                {record.thoughts.length > 0 && (
                  <ul className="record-thoughts" aria-label={`这一段记下的 ${record.thoughts.length} 条想法`}>
                    {record.thoughts.map((t) => <li key={t.id}>{thoughtText(t.text)}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
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
