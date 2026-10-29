import { formatMinutes } from '../components/format'
import { WeekChart } from '../components/WeekChart'
import type { StatsView } from '../hooks/useViews'

export function StatsScreen({ view }: { view: StatsView }) {
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
                <span>{record.endReason === 'manual' ? '手动结束' : '到时结束'} · 目标 {formatMinutes(record.targetMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
