import { blueCompanionSpec } from '../../data/blue-companion'

export function CompanionPaint({ id }: { id: string }) {
  const { palette } = blueCompanionSpec
  return <defs>
    <linearGradient id={`${id}-body`} x1="20%" y1="0%" x2="85%" y2="100%">
      <stop stopColor={palette.light}/><stop offset=".46" stopColor={palette.body}/><stop offset="1" stopColor={palette.shade}/>
    </linearGradient>
    <linearGradient id={`${id}-belly`} x1="10%" y1="0%" x2="65%" y2="100%">
      <stop stopColor={palette.white}/><stop offset="1" stopColor={palette.belly}/>
    </linearGradient>
  </defs>
}
