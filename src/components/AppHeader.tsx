interface Props { settingsOpen: boolean; onSettings: () => void }

export function AppHeader({ settingsOpen, onSettings }: Props) {
  return (
    <header className="app-header">
      <div className="app-wordmark">
        <span className="brand-dot" aria-hidden="true"><span /><span /></span>
        <h1 className="app-title">Whale Focus</h1>
      </div>
      <button type="button" className="settings-entry" onClick={onSettings} aria-label={settingsOpen ? '关闭设置，回到专注' : '设置'}>
        {settingsOpen ? <span aria-hidden="true">×</span> : <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 4v16M12 4v16M19 4v16"/><path d="M2 8h6M9 15h6M16 9h6" strokeWidth="3.5"/></svg>}
      </button>
    </header>
  )
}
