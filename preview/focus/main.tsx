import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../../src/App'
import '../../src/styles.css'
import '../../src/styles/focus.css'

// Serve on a dedicated development origin and use a fresh browser context per trial.
const layout = new URLSearchParams(location.search).get('layout') === 'cards' ? 'cards' : 'console'
createRoot(document.getElementById('root')!).render(<StrictMode><App entryLayout={layout} /></StrictMode>)
