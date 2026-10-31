import { useBarsSketch } from '../hooks/useSketches'
import type { DayTotal } from '../logic/stats'
import type { DateKey } from '../logic/types'
import { formatMinutes } from './format'
import { SketchSvg } from './SketchSvg'

const WIDTH = 320
const HEIGHT = 140

interface Props {
  days: readonly DayTotal[]
  todayKey: DateKey
}

export function WeekChart({ days, todayKey }: Props) {
  const minutes = days.map((d) => d.focusMs / 60_000)
  const todayIndex = days.findIndex((d) => d.dateKey === todayKey)
  const bars = useBarsSketch(minutes, todayIndex, WIDTH, HEIGHT)
  return (
    <figure className="week-chart">
      <SketchSvg sketch={bars} className="week-bars" />
      <div className="range-chart-labels" aria-hidden="true"><span>{days[0]?.dateKey.slice(5)}</span><span>{todayKey.slice(5)}</span></div>
      <figcaption className="sr-only">
        <ul>
          {days.map((d, i) => (
            <li key={d.dateKey}>
              {d.dateKey}
              {i === todayIndex ? '（今天）' : ''}: {formatMinutes(d.focusMs)}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
