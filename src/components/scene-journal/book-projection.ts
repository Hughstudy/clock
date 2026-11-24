// Rotating a closed book in its own camera keeps the near edge horizontal at
// every placement. Project the ink and the paper edge together into one SVG
// so WebKit also paints the model around its local vanishing point.
const width = 333
const height = 444
const depth = 48
const focal = 2200
type Point = readonly [number, number]
type Command = ['M' | 'L', number, number] | ['Q', number, number, number, number] | ['Z']
type Ink = readonly [color: string, commands: Command[]]

function camera(pitch: number) {
  const angle = pitch * Math.PI / 180
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return (x: number, y: number, z = 0): Point => {
    const localY = y - height / 2
    const zoom = focal / (focal - localY * sin - z * cos)
    return [width / 2 + (x - width / 2) * zoom, height / 2 + (localY * cos - z * sin) * zoom]
  }
}

function roundRect(x: number, y: number, w: number, h: number, r: number): Command[] {
  return [
    ['M', x + r, y], ['L', x + w - r, y], ['Q', x + w, y, x + w, y + r],
    ['L', x + w, y + h - r], ['Q', x + w, y + h, x + w - r, y + h],
    ['L', x + r, y + h], ['Q', x, y + h, x, y + h - r],
    ['L', x, y + r], ['Q', x, y, x + r, y], ['Z'],
  ]
}

const cover: readonly Ink[] = [
  ['#344969', roundRect(0, 0, width, height, 10)],
  ['#4d648c', roundRect(2, 2, 329, 440, 8)],
  ['#3b5177', [['M', 8, 2], ['L', 32, 2], ['L', 32, 442], ['L', 8, 442],
    ['Q', 2, 442, 2, 436], ['L', 2, 8], ['Q', 2, 2, 8, 2], ['Z']]],
  ['#9dacc3', roundRect(32.25, 3, 1.5, 438, .7)],
  ['#8b9db5', [...roundRect(48, 24, 265, 396, 10), ...roundRect(50, 26, 261, 392, 8)]],
  ['#e9d6af', roundRect(112, 108, 138, 128, 14)],
]
const coverColors = cover.map(([color]) => color)
const coverCorners: readonly Point[] = [[0, 0], [width, 0], [width, height], [0, height]]
const cornerNames = ['tl', 'tr', 'br', 'bl']
const pageLines = Array.from({ length: 6 }, (_, i) => 7 + i * 6.5)
const edgeColors = ['#344969', '#4d648c', '#efe3c9', '#d6c6a3', '#4d648c']
const iconAndTitle = `<path transform="translate(-14 -89)" d="M11 50V26C11 4 47 4 47 26V50ZM29 10V50M11 31H47"
  fill="none" stroke="#586980" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="15" y="0" fill="#44506a" text-anchor="middle" font-size="21" font-weight="700" letter-spacing="3"
    font-family="Songti SC, Noto Serif SC, STSong, serif">窗边手记</text>`

const numbers = (coordinates: readonly number[]) => coordinates.map(n => Number(n.toFixed(4))).join(' ')

function closedGeometry(pitch: number) {
  const project = camera(pitch)
  const inkPath = (commands: Command[]) => commands.map(command => {
    if (command[0] === 'Z') return 'Z'
    const start = numbers(project(command[1], command[2]))
    return command[0] === 'Q'
      ? 'Q' + start + ' ' + numbers(project(command[3], command[4]))
      : command[0] + start
  }).join(' ')
  const nearFace = (vertices: readonly Point[]) => vertices.map(([x, z], i) =>
    (i ? 'L' : 'M') + numbers(project(x, height, -z))).join(' ') + 'Z'
  const band = (start: number, end: number) => nearFace([[0, start], [width, start], [width, end], [0, end]])
  const edge = [band(0, depth), band(2, depth - 2), band(6, depth - 6),
    pageLines.map(line => band(line, Math.min(line + 1.5, depth - 6))).join(' '), band(depth - 5, depth - 2)]
  const ribbon = nearFace([[226, 23], [246, 23], [246, 42], [236, 38], [226, 42]])
  // The small window and type use the tangent plane at the printed label.
  const origin = project(166, 215)
  const dx = project(167, 215)
  const dy = project(166, 216)
  return {
    cover: cover.map(([, commands]) => inkPath(commands)),
    edge, ribbon, corners: coverCorners.map(([x, y]) => project(x, y)),
    label: 'matrix(' + numbers([dx[0] - origin[0], dx[1] - origin[1], dy[0] - origin[0], dy[1] - origin[1], ...origin]) + ')',
  }
}

const paths = (data: string[], colors: string[]) =>
  data.map((d, i) => '<path fill="' + colors[i] + '" d="' + d + '"/>').join('')

function frontInk(geometry: ReturnType<typeof closedGeometry>) {
  return `<g data-cover-paint fill-rule="evenodd">${paths(geometry.cover, coverColors)}</g>
    <g data-cover-label transform="${geometry.label}">${iconAndTitle}</g>`
}

// All markup comes from the authored drawing above. The live hinge uses this
// same drawing at zero pitch; its CSS camera supplies the remaining perspective.
export const coverDrawing = `<svg viewBox="0 0 333 444" width="100%" height="100%" aria-hidden="true" focusable="false">
  ${frontInk(closedGeometry(0))}
</svg>`

function projectedMarkup(pitch: number) {
  const geometry = closedGeometry(pitch)
  return `<svg xmlns="http://www.w3.org/2000/svg" class="journal-projection" viewBox="0 0 333 444" overflow="visible" aria-hidden="true" focusable="false">
    <g class="journal-edge-bottom">${paths(geometry.edge, edgeColors)}<path class="journal-ribbon" d="${geometry.ribbon}" fill="#bc7557"/></g>
    <g data-scene-book-cover>
      ${frontInk(geometry)}
      ${geometry.corners.map(([x, y], i) => `<rect data-cover-corner="${cornerNames[i]}" x="${x}" y="${y}" width=".001" height=".001" fill="none"/>`).join('')}
    </g>
  </svg>`
}

export const restJournalMarkup = projectedMarkup(73)
type ProjectionNodes = {
  edge: HTMLCollection
  cover: HTMLCollection
  label: Element
  ribbon: Element
  corners: NodeListOf<Element>
}
const nodesByBook = new WeakMap<SVGSVGElement, ProjectionNodes>()

export function createProjectedBook(): SVGSVGElement {
  const template = document.createElement('template')
  template.innerHTML = restJournalMarkup
  const svg = template.content.firstElementChild as SVGSVGElement
  nodesByBook.set(svg, {
    edge: svg.querySelector('.journal-edge-bottom')!.children,
    cover: svg.querySelector('[data-cover-paint]')!.children,
    label: svg.querySelector('[data-cover-label]')!,
    ribbon: svg.querySelector('.journal-ribbon')!,
    corners: svg.querySelectorAll('[data-cover-corner]'),
  })
  return svg
}

export function paintProjectedBook(svg: SVGSVGElement, pitch: number): void {
  const nodes = nodesByBook.get(svg)
  if (!nodes) return
  const geometry = closedGeometry(pitch)
  geometry.cover.forEach((d, i) => nodes.cover[i]!.setAttribute('d', d))
  geometry.edge.forEach((d, i) => nodes.edge[i]!.setAttribute('d', d))
  nodes.ribbon.setAttribute('d', geometry.ribbon)
  nodes.label.setAttribute('transform', geometry.label)
  geometry.corners.forEach(([x, y], i) => {
    nodes.corners[i]!.setAttribute('x', String(x))
    nodes.corners[i]!.setAttribute('y', String(y))
  })
}
