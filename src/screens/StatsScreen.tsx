import { formatMinutes, plural } from '../components/format'
import { WeekChart } from '../components/WeekChart'
import type { StatsView } from '../hooks/useViews'

interface Props {
  view: StatsView
}

export function StatsScreen({ view }: Props) {
  const { today, week, streak } = view
  const streakHint =
    streak.days === 0
      ? 'Finish a focus session to start one.'
      : streak.includesToday
        ? 'Today counts. Nice work!'
        : 'Finish one today to keep it going.'
  return (
    <section className="screen stats" aria-labelledby="stats-title">
      <h2 id="stats-title" className="screen-title">
        Stats
      </h2>
      <div className="stat-grid">
        <div className="stat">
          <p className="stat-label">Focus today</p>
          <p className="stat-value">{formatMinutes(today.focusMs)}</p>
          <p className="stat-detail">{plural(today.count, 'session', 'sessions')} completed</p>
        </div>
        <div className="stat">
          <p className="stat-label">This week</p>
          <p className="stat-value">{formatMinutes(week.focusMs)}</p>
          <p className="stat-detail">{plural(week.count, 'session', 'sessions')} completed</p>
        </div>
        <div className="stat">
          <p className="stat-label">Rice served</p>
          <p className="stat-value">{plural(view.totalRice, 'bowl', 'bowls')}</p>
          <p className="stat-detail">{plural(today.count, 'bowl', 'bowls')} today</p>
        </div>
        <div className="stat">
          <p className="stat-label">Streak</p>
          <p className="stat-value">{plural(streak.days, 'day', 'days')}</p>
          <p className="stat-detail">{streakHint}</p>
        </div>
      </div>
      <div className="card">
        <h3 className="card-title">Completed focus minutes this week</h3>
        <WeekChart days={week.days} todayKey={view.todayKey} firstWeekday={view.firstWeekday} />
      </div>
    </section>
  )
}
