export type Screen = 'home' | 'stats' | 'settings'
const TABS = [
  { id: 'home', label: '专注', path: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2M16 3h5v5' },
  { id: 'stats', label: '记录', path: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3' },
] as const
interface Props { active: Screen; onSelect: (screen: Screen) => void }
export function TabBar({ active, onSelect }: Props) {
  return <nav className="tab-bar" aria-label="主导航">
    {TABS.map(tab => <button key={tab.id} type="button" className="tab" aria-current={tab.id === active ? 'page' : undefined} onClick={() => onSelect(tab.id)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={tab.path}/></svg>
      <span>{tab.label}</span>
    </button>)}
  </nav>
}
