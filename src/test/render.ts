import type { Sketch, Tone } from '../logic/sketch'

/** Serializes a sketch to standalone SVG markup with concrete colors (for icons and visual review). */
export function sketchToSvg(sketch: Sketch, palette: Record<Tone, string>, background?: string): string {
  const { x, y, width, height } = sketch
  // With a background, the drawing is clipped to a round avatar.
  const circle = `cx="${x + width / 2}" cy="${y + height / 2}" r="${width / 2}"`
  const open = background ? `<clipPath id="avatar"><circle ${circle}/></clipPath><circle ${circle} fill="${background}"/><g clip-path="url(#avatar)">` : ''
  const close = background ? '</g>' : ''
  const paths = sketch.paths
    .map((p) =>
      p.kind === 'fill'
        ? `<path d="${p.d}" fill="${palette[p.tone]}"/>`
        : `<path d="${p.d}" fill="none" stroke="${palette[p.tone]}" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}">${open}${paths}${close}</svg>\n`
}
