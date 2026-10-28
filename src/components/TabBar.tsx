import { useUnderlineSketch } from '../hooks/useSketches'
import { SketchSvg } from './SketchSvg'

export type Screen = 'home' | 'stats' | 'settings'

const TABS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Timer' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
]

interface Props {
  active: Screen
  onSelect: (screen: Screen) => void
}

export function TabBar({ active, onSelect }: Props) {
  const underline = useUnderlineSketch(64)
  return (
    <nav className="tab-bar" aria-label="Screens">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tab"
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          <span>{tab.label}</span>
          {tab.id === active && <SketchSvg sketch={underline} className="tab-underline" />}
        </button>
      ))}
    </nav>
  )
}
