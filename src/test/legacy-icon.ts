import { isTone, SketchBuilder, type ShapeOptions } from '../logic/sketch'
import source from './fixtures/legacy-icon.json'

/** Only the retained install icon uses this artwork. Never import it from the app. */
export function sketchInstallIcon() {
  const builder = new SketchBuilder(source.seed, source)
  for (const part of source.parts) {
    const shape: ShapeOptions = {
      strokeWidth: part.width ?? source.outlineWidth,
      fillStyle: 'solid', singleStroke: true, seedKey: part.name,
    }
    if (part.stroke) {
      if (!isTone(part.stroke)) throw new Error(`Invalid icon stroke: ${part.name}`)
      shape.stroke = part.stroke
    }
    if (part.fill) {
      if (!isTone(part.fill)) throw new Error(`Invalid icon fill: ${part.name}`)
      shape.fill = part.fill
    }
    builder.add(builder.gen.path(part.d, builder.options(shape)))
  }
  const [x, y, width, height] = source.frame
  if (x === undefined || y === undefined || width === undefined || height === undefined) throw new Error('Invalid icon frame')
  return builder.build(width, height, x, y)
}

export const iconPalette = source.palette
