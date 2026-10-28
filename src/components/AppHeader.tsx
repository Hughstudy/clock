import { useCharacterSketch, useUnderlineSketch } from '../hooks/useSketches'
import { SketchSvg } from './SketchSvg'

export function AppHeader() {
  return (
    <header className="app-header">
      <SketchSvg sketch={useCharacterSketch('idle', 'face')} className="logo" />
      <div>
        <h1 className="app-title">Whale Focus</h1>
        <SketchSvg sketch={useUnderlineSketch(150)} className="title-underline" />
      </div>
    </header>
  )
}
