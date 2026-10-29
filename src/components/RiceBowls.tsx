import { useRiceBowlSketch } from '../hooks/useSketches'
import { SketchSvg } from './SketchSvg'

function Bowl({ filled, variant }: { filled: boolean; variant: number }) {
  return <SketchSvg sketch={useRiceBowlSketch(filled, variant)} className="cycle-bowl" />
}

interface Props {
  done: number
  total: number
}

/** A cadence suggestion, never a requirement to earn rest. Legacy artwork is temporary. */
export function RiceBowls({ done, total }: Props) {
  const label = done >= total ? 'A long break is suggested. Rest whenever you need.' : `${done} of ${total} sessions in this cycle. Rest whenever you need.`
  return (
    <div className="cycle" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <Bowl key={i} filled={i < done} variant={i} />
      ))}
    </div>
  )
}
