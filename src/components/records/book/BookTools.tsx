import { useState, type ReactNode } from 'react'
import type { Persistence, StoreNotice } from '../../../adapters/storage'
import { useHistoryRange, type StatsView } from '../../../hooks/useViews'
import type { MonthFilter } from '../../../logic/records-query'
import type { RangeLength } from '../../../logic/stats'
import { formatMinutes, PHASE_LABELS } from '../../format'
import { WeekChart } from '../../WeekChart'
import './book-tools.css'

interface Props {
  kind: 'month' | 'stats' | 'status'
  view: StatsView
  month: MonthFilter
  hasUnknownDates?: boolean
  onMonth: (value: MonthFilter) => void
  persistence: Persistence
  notice: StoreNotice | null
  hasSaveError: boolean
  systemNoticeSummary?: string | null | undefined
  systemNotices?: ReactNode
  onTurn: (update: () => void) => void
}

function MonthPage({ view, month, hasUnknownDates, onMonth }: Pick<Props, 'view' | 'month' | 'hasUnknownDates' | 'onMonth'>) {
  const [year, setYear] = useState((month && month !== 'unknown' ? month : view.todayKey).slice(0, 4))
  const validYear = /^\d{1,4}$/.test(year) && Number(year) > 0
  return <>
    <h2>选择月份</h2>
    <label className="book-year">年份<input type="text" inputMode="numeric" autoComplete="off" maxLength={4}
      value={year} aria-invalid={!validYear} onChange={event => setYear(event.target.value)} /></label>
    {!validYear && <p className="field-error">请输入1到9999之间的年份。</p>}
    <div className="book-months">{Array.from({ length: 12 }, (_, i) => {
      const value = year.padStart(4, '0') + '-' + String(i + 1).padStart(2, '0')
      return <button key={i} type="button" disabled={!validYear}
        aria-pressed={month === value} onClick={() => onMonth(value)}>{i + 1}月</button>
    })}</div>
    <button type="button" className="link-button" onClick={() => onMonth(null)}>查看全部日期</button>
    {hasUnknownDates && <button type="button" className="link-button" onClick={() => onMonth('unknown')}>日期不详的记录</button>}
  </>
}

function StatsPage({ view, notice, onTurn }: Pick<Props, 'view' | 'notice' | 'onTurn'>) {
  const [length, setLength] = useState<RangeLength>(7)
  const [trend, setTrend] = useState(false)
  const { totals } = useHistoryRange(view, length)
  const incomplete = notice?.kind === 'unreadable' || notice?.kind === 'unavailable' ||
    (notice?.kind === 'repaired' && notice.fields.some(field => field.startsWith('records')))
  return <>
    <h2>专注时光</h2>
    <div className="book-range" role="group" aria-label="计时统计范围">{([7, 30] as const).map(days =>
      <button key={days} type="button" aria-pressed={length === days}
        onClick={() => { if (days !== length) onTurn(() => setLength(days)) }}>近{days}天</button>)}</div>
    <p>{view.shortDate(totals.startKey)} – {view.shortDate(view.todayKey)}</p>
    {incomplete ? <p>计时汇总暂不可确认。</p> : <>
      <p className="book-elapsed">{formatMinutes(totals.focusMs)}</p>
      <p>{totals.count} 段已结束专注 · 只统计已确认保存的时间</p>
      <button type="button" className="link-button" aria-expanded={trend}
        onClick={() => onTurn(() => setTrend(!trend))}>{trend ? '收起趋势' : '查看趋势'}</button>
      {trend && <WeekChart days={totals.days} todayKey={view.todayKey}/>}
    </>}
  </>
}

function StatusPage({ view, notice, hasSaveError, persistence, systemNoticeSummary, systemNotices }: Pick<Props,
  'view' | 'notice' | 'hasSaveError' | 'persistence' | 'systemNoticeSummary' | 'systemNotices'>) {
  return <>
    <h2>应用状态</h2>
    {view.active && <p>{PHASE_LABELS[view.active.phase]} · {view.active.status === 'paused' ? '已暂停' : '正在计时'}（未计入汇总）</p>}
    {hasSaveError && <p>有内容待保存，原内容仍在。</p>}
    {persistence === 'memory-only' && <p>当前内容仅保留在此页面。</p>}
    {systemNotices ?? (systemNoticeSummary && <p>{systemNoticeSummary}</p>)}
    {!view.active && !hasSaveError && !notice && !systemNoticeSummary && persistence === 'saved' && <p>目前没有需要处理的应用状态。</p>}
  </>
}

export function BookTools(props: Props) {
  return <section className="book-tools" data-jl-detail={props.kind}>
    {props.kind === 'month' ? <MonthPage {...props}/> : props.kind === 'stats' ? <StatsPage {...props}/> : <StatusPage {...props}/>}
  </section>
}
