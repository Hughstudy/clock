import { readRestBook, type RestBook } from './book-art'

interface Surface {
  host: HTMLDivElement
  content: ShadowRoot
}

export interface FocusCapture {
  prop: RestBook
  room: HTMLDivElement
  shadow: Element | null
  space: DOMRect
  clock: DOMRect
  controls: DOMRect
}

export interface RecordsCapture {
  page: HTMLDivElement
  chrome: HTMLDivElement
  target: DOMRect
  bounds: DOMRect
  navBounds: DOMRect
  shadow: string
  restoreScroll: () => void
}

const sheets = new WeakMap<CSSStyleSheet, { css: string; shared?: CSSStyleSheet }>()

/** Synchronously reuse the already loaded application CSS, including the built Pages stylesheet.
 * Each print has its own ID and SVG paint-server namespace and no live controls. */
function surface(className: string, extraCSS = ''): Surface {
  const host = document.createElement('div')
  host.className = className
  const content = host.attachShadow({ mode: 'closed' })
  const adopted: CSSStyleSheet[] = []
  const canAdopt = 'adoptedStyleSheets' in content && typeof CSSStyleSheet.prototype.replaceSync === 'function'
  for (const original of document.styleSheets) {
    if (original.disabled) continue
    let cached = sheets.get(original)
    if (!cached) {
      // App assets are same-origin. Browser extensions can add foreign sheets
      // which must not affect whether navigation succeeds.
      try { cached = { css: Array.from(original.cssRules, rule => rule.cssText).join('\n') } }
      catch { continue }
      sheets.set(original, cached)
    }
    const media = original.media.mediaText
    if (canAdopt) {
      if (!cached.shared) {
        cached.shared = new CSSStyleSheet({ baseURL: original.href ?? document.baseURI, media })
        cached.shared.replaceSync(cached.css)
      }
      adopted.push(cached.shared)
    } else {
      // A cloned <link> can paint an unstyled first frame while it loads.
      const style = document.createElement('style')
      style.media = media
      style.textContent = cached.css
      content.append(style)
    }
  }
  if (canAdopt) content.adoptedStyleSheets = adopted
  const still = document.createElement('style')
  still.textContent = '* { animation: none !important; transition: none !important }' + extraCSS
  content.append(still)
  return { host, content }
}

function placeApp(copy: HTMLElement, bounds: DOMRect) {
  Object.assign(copy.style, {
    position: 'absolute', left: bounds.left + 'px', top: bounds.top + 'px', width: bounds.width + 'px', margin: '0',
  })
}

// Preserve mid-breath and partially raised poses before freezing the room.
// The SVG activity itself already contains its rendered pose coordinates.
function freezeAnimations(app: HTMLElement, print: HTMLElement) {
  const animations = app.getAnimations?.({ subtree: true }) ?? []
  if (!animations.length) return
  const originals = [app, ...app.querySelectorAll('*')]
  const copies = [print, ...print.querySelectorAll('*')]
  for (const animation of animations) {
    const effect = animation.effect
    if (!(effect instanceof KeyframeEffect) || !effect.target || effect.pseudoElement) continue
    const copy = copies[originals.indexOf(effect.target)]
    if (!(copy instanceof HTMLElement || copy instanceof SVGElement)) continue
    const style = getComputedStyle(effect.target)
    for (const key of Object.keys(effect.getKeyframes()[0] ?? {})) {
      const property = key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())
      const value = style.getPropertyValue(property)
      if (value) copy.style.setProperty(property, value)
    }
  }
}

export function captureFocus(app: HTMLElement): FocusCapture | null {
  const prop = readRestBook(app)
  const scene = app.querySelector('.fp-scene')
  const clock = app.querySelector('.fp-digits')
  const controls = app.querySelector('.fp-controls')
  if (!prop || !scene || !clock || !controls) return null
  const room = surface('scene-fold-room', '[data-scene-book-block] { visibility: hidden !important }')
  const print = app.cloneNode(true) as HTMLElement
  freezeAnimations(app, print)
  placeApp(print, app.getBoundingClientRect())
  room.content.append(print)
  return {
    prop, room: room.host, shadow: print.querySelector('[data-scene-book-shadow]'),
    space: scene.getBoundingClientRect(), clock: clock.getBoundingClientRect(), controls: controls.getBoundingClientRect(),
  }
}

export function captureRecords(app: HTMLElement): RecordsCapture | null {
  const journal = app.querySelector<HTMLElement>('#ribbon-journal')
  const book = journal?.querySelector<HTMLElement>('.rj-book')
  const header = journal?.querySelector('.rj-top')
  const nav = app.querySelector<HTMLElement>('.tab-bar')
  const main = app.querySelector('main')
  if (!journal || !book || !header || !nav || !main) return null
  const target = book.getBoundingClientRect()
  if (!target.width || !target.height) return null

  const page = surface('scene-fold-page', '#ribbon-journal .bm-cover { display: none !important }')
  const paper = journal.cloneNode(false) as HTMLElement
  // Keep the live chapter's container query width, line breaks and type size.
  Object.assign(paper.style, {
    width: journal.getBoundingClientRect().width + 'px', height: target.height + 'px', minHeight: '0', display: 'block',
  })
  const printed = book.cloneNode(true) as HTMLElement
  // An internal bookmark/leaf turn may still have a temporary print over it.
  printed.querySelector('.bm-transition')?.remove()
  Object.assign(printed.style, { width: target.width + 'px', height: target.height + 'px' })
  paper.append(printed)
  page.content.append(paper)
  const scroll = book.querySelector('.jl-body')
  const offset = { left: scroll?.scrollLeft ?? 0, top: scroll?.scrollTop ?? 0 }
  const restoreScroll = () => printed.querySelector('.jl-body')?.scrollTo(offset)

  const chrome = surface('scene-fold-chrome')
  const frame = app.cloneNode(false) as HTMLElement
  const bounds = app.getBoundingClientRect()
  placeApp(frame, bounds)
  const mainPrint = main.cloneNode(false) as HTMLElement
  const top = journal.cloneNode(false) as HTMLElement
  top.append(header.cloneNode(true))
  mainPrint.append(top)
  const navBounds = nav.getBoundingClientRect()
  const bar = nav.cloneNode(true) as HTMLElement
  Object.assign(bar.style, { left: navBounds.left + 'px', width: navBounds.width + 'px' })
  frame.append(mainPrint, bar)
  chrome.content.append(frame)
  return { target, bounds, navBounds, shadow: getComputedStyle(book).boxShadow, page: page.host, chrome: chrome.host, restoreScroll }
}
