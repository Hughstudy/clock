import { SketchBuilder, type Sketch } from './sketch'
import type { CharacterSpec, Frame, Pose } from './spec'

export interface CharacterInput {
  character: CharacterSpec
  pose: Pose
  frame: Frame
  seed: number
}

/**
 * Whale-chan in one pose. Every pose comes from the same data-driven part
 * list, and each part's seed depends only on its name, so shared parts are
 * drawn identically across poses.
 */
export function sketchCharacter({ character, pose, frame, seed }: CharacterInput): Sketch {
  const b = new SketchBuilder(seed, { roughness: character.roughness, bowing: character.bowing })
  for (const name of character.poses[pose]) {
    const part = character.parts[name]
    if (!part) continue
    const shape = {
      strokeWidth: part.width ?? character.outlineWidth,
      fillStyle: 'solid' as const,
      singleStroke: true,
      seedKey: name,
      ...(part.stroke ? { stroke: part.stroke } : {}),
      ...(part.fill ? { fill: part.fill } : {}),
    }
    b.add(b.gen.path(part.d, b.options(shape)))
  }
  const [x, y, width, height] = character.frames[frame]
  return b.build(width, height, x, y)
}
