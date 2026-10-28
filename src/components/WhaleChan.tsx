import { useCharacterSketch } from '../hooks/useSketches'
import type { CharacterView } from '../hooks/useCharacter'
import { SketchSvg } from './SketchSvg'

interface Props {
  character: CharacterView
}

/** Whale-chan with a speech bubble. Each pose is a cached sketch; only CSS animates. */
export function WhaleChan({ character }: Props) {
  const sketch = useCharacterSketch(character.pose)
  return (
    <div className={`stage pose-${character.pose}`}>
      <SketchSvg key={character.pose} sketch={sketch} className="whale" title={character.alt} />
      <p className="bubble">{character.caption}</p>
    </div>
  )
}
