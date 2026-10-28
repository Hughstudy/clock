import { useBarsSketch } from '../hooks/useSketches'
import type { DayTotal } from '../logic/stats'
import type { DateKey } from '../logic/types'
import { formatMinutes } from './format'
import { SketchSvg } from './SketchSvg'

const WIDTH = 320
const HEIGHT = 140

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  days: readonly DayTotal[]
  todayKey: DateKey
  /** Weekday index (0 = Sunday) of the first entry in `days`. */
  firstWeekday: number
}

export function WeekChart({ days, todayKey, firstWeekday }: Props) {
  const minutes = days.map((d) => Math.round(d.focusMs / 60_000))
  const todayIndex = days.findIndex((d) => d.dateKey === todayKey)
  const bars = useBarsSketch(minutes, todayIndex, WIDTH, HEIGHT)
  const names = days.map((_, i) => DAY_NAMES[(firstWeekday + i) % 7] ?? '')
  return (
    <figure className="week-chart">
      <SketchSvg sketch={bars} className="week-bars" />
      <ol className="week-labels" aria-hidden="true">
        {names.map((name, i) => (
          <li key={name} className={i === todayIndex ? 'is-today' : undefined}>
            {name.slice(0, 1)}
          </li>
        ))}
      </ol>
      <figcaption className="sr-only">
        <ul>
          {days.map((d, i) => (
            <li key={d.dateKey}>
              {names[i]}
              {i === todayIndex ? ' (today)' : ''}: {formatMinutes(d.focusMs)} focused
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
