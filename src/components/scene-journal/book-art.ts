import { coverDrawing } from './book-projection'
export { createProjectedBook, paintProjectedBook } from './book-projection'

// An inert volume with a left-hand hinge. The current Records page goes in
// the slot beneath the cover as soon as the user selects their destination.
const journalMarkup = `
  <span class="journal-block" aria-hidden="true">
    <span class="journal-edge journal-edge-top"></span>
    <span class="journal-edge journal-edge-left"></span>
    <span class="journal-edge journal-edge-right"></span>
    <span class="journal-edge journal-edge-bottom"><span class="journal-ribbon"></span></span>
    <span class="journal-pages-slot"></span>
    <span class="journal-hinge">
      <span class="journal-face journal-front" data-scene-book-cover>
        ${coverDrawing}
        <span class="journal-front-shade"></span>
        <i data-cover-corner="tl"></i><i data-cover-corner="tr"></i>
        <i data-cover-corner="br"></i><i data-cover-corner="bl"></i>
      </span>
      <span class="journal-face journal-back"><span class="journal-back-shade"></span></span>
    </span>
  </span>`

export function createJournalBlock(): HTMLSpanElement {
  const template = document.createElement('template')
  template.innerHTML = journalMarkup
  return template.content.firstElementChild as HTMLSpanElement
}

export interface RestBook {
  r: DOMRect
  center: [number, number]
  width: number
}

export function readRestBook(app: HTMLElement): RestBook | null {
  const rig = app.querySelector('[data-scene-book-block]')
  if (!rig || getComputedStyle(rig).visibility !== 'visible') return null
  const model = rig.getBoundingClientRect()
  const r = rig.querySelector('[data-scene-book-cover]')?.getBoundingClientRect()
  if (!model.width || !r?.width || !r.height) return null
  return {
    r,
    center: [model.x + model.width / 2, model.y + model.height / 2],
    width: model.width,
  }
}
