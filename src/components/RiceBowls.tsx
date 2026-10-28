import { useRiceBowlSketch } from '../hooks/useSketches'
import { SketchSvg } from './SketchSvg'

function Bowl({ filled, variant }: { filled: boolean; variant: number }) {
  return <SketchSvg sketch={useRiceBowlSketch(filled, variant)} className="cycle-bowl" />
}

interface Props {
  done: number
  total: number
}

/** Progress toward the long break, one bowl per completed focus session. */
export function RiceBowls({ done, total }: Props) {
  const label = done >= total ? 'Long break earned' : `${done} of ${total} focus sessions toward a long break`
  return (
    <div className="cycle" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <Bowl key={i} filled={i < done} variant={i} />
      ))}
    </div>
  )
}
