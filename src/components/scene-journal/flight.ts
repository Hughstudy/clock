import { createJournalBlock, createProjectedBook, paintProjectedBook } from './book-art'
import type { FocusCapture, RecordsCapture } from './snapshots'

const glide = 'cubic-bezier(.5, 0, .2, 1)'
const swing = 'cubic-bezier(.45, .05, .2, 1)'
const pickup = .52
const open = .93
const faceChange = .668

function layer(className: string) {
  return Object.assign(document.createElement('div'), { className })
}

function foreground({ space, clock, controls }: FocusCapture, target: DOMRect, height: number) {
  const x = Math.max(0, space.left) + Math.min(space.width, innerWidth) / 2
  const top = Math.max(0, clock.bottom) + 10
  const sharesColumn = controls.left < x && controls.right > x && controls.top > top
  const bottom = Math.min(innerHeight, sharesColumn ? controls.top : space.bottom) - 10
  const scale = Math.min(.7, Math.max(1, bottom - top) / (height * 1.03), space.width * .85 / target.width)
  return { x, y: (top + bottom) / 2, scale }
}

export function playJournalFlight(stage: HTMLElement, focus: FocusCapture, records: RecordsCapture, forward: boolean) {
  const { prop, room } = focus
  const { target, page, chrome } = records
  const book = createJournalBlock()
  const jacket = createProjectedBook()
  jacket.classList.add('scene-fold-closed')
  const width = target.width
  const height = width * 4 / 3
  const centerX = target.left + width / 2
  const centerY = target.top + height / 2
  const hold = foreground(focus, target, height)

  function pose(x: number, y: number, pitch: number, scale: number) {
    const planar = `translate3d(${x - centerX}px,${y - centerY}px,0) scale(${scale})`
    const physical = `${planar} perspective(${width * 2200 / 333}px) rotateX(${pitch}deg)`
    return { planar, physical }
  }
  const flat = pose(centerX, centerY, 0, 1)
  const stops = [
    { offset: 0, pose: pose(...prop.center, 73, prop.width / width), easing: glide, shadow: 0 },
    { offset: .45, pose: pose(hold.x, hold.y, 7, hold.scale), easing: 'ease-in-out', shadow: .8 },
    { offset: pickup, pose: pose(hold.x, hold.y, 5, hold.scale * 1.02), easing: swing, shadow: .8 },
    { offset: open, pose: flat, easing: 'linear', shadow: 0 },
    { offset: 1, pose: flat, easing: 'linear', shadow: 0 },
  ]
  const cast = layer('scene-fold-cast')
  const pageShadow = layer('scene-fold-page-shadow')
  const scrim = layer('scene-fold-scrim')
  const gutter = layer('scene-fold-gutter')
  const bounds = { left: target.left + 'px', top: target.top + 'px', width: width + 'px' }
  Object.assign(pageShadow.style, bounds, { height: target.height + 'px', boxShadow: records.shadow })
  for (const node of [book, cast, jacket]) Object.assign(node.style, bounds, { height: height + 'px' })
  page.style.height = gutter.style.height = target.height + 'px'
  const slot = book.querySelector<HTMLElement>('.journal-pages-slot')!
  const back = book.querySelector<HTMLElement>('.journal-back')!
  const front = book.querySelector<HTMLElement>('.journal-front')!
  slot.append(page, gutter)
  stage.append(room, scrim, pageShadow, cast, book, jacket, chrome)
  records.restoreScroll()

  const options: KeyframeAnimationOptions = {
    duration: forward ? 1300 : 900, direction: forward ? 'normal' : 'reverse', fill: 'both',
  }
  const tracks: Animation[] = []
  const run = (node: Element, frames: Keyframe[]) => {
    const track = node.animate(frames, options)
    tracks.push(track)
    return track
  }
  const opacity = (node: Element, keys: [number, number][]) =>
    run(node, keys.map(([offset, opacity]) => ({ offset, opacity })))
  const visibility = (node: Element, change: number, early: string, late: string) => run(node, [
    { offset: 0, visibility: early, easing: 'steps(1, end)' },
    { offset: change, visibility: late }, { offset: 1, visibility: late },
  ])

  const movement = run(book, stops.map(({ offset, pose, easing }) => ({ offset, transform: pose.physical, easing })))
  // A flat projection keeps the rigid jacket and the page edges registered in
  // WebKit as it rises. The physical hinge takes over at the foreground hold.
  run(jacket, stops.map(({ offset, pose, easing }) => ({ offset, transform: pose.planar, easing })))
  visibility(jacket, pickup, 'visible', 'hidden')
  visibility(slot, pickup, 'hidden', 'visible')
  run(cast, stops.map(({ offset, pose, easing, shadow }) => ({ offset, transform: pose.physical, easing, opacity: shadow })))

  const shutCover = 'translateZ(.6px) rotateY(0deg)'
  const openCover = 'translateZ(.6px) rotateY(-172deg)'
  run(book.querySelector('.journal-hinge')!, [
    { offset: 0, transform: shutCover }, { offset: pickup, transform: shutCover, easing: swing },
    { offset: open, transform: openCover }, { offset: 1, transform: openCover },
  ])
  // Cull the front at the edge-on angle. Some WebKit compositors otherwise
  // show its mirrored ink through the back of the nested hinge.
  run(front, [
    { offset: 0, visibility: 'hidden', easing: 'steps(1, end)' },
    { offset: pickup, visibility: 'visible', easing: 'steps(1, end)' },
    { offset: faceChange, visibility: 'hidden' }, { offset: 1, visibility: 'hidden' },
  ])
  visibility(back, faceChange, 'hidden', 'visible')
  opacity(back, [[0, 1], [open, 1], [1, 0]])
  opacity(book.querySelector('.journal-front-shade')!, [[0, 0], [pickup, 0], [.7, .34], [1, .34]])
  opacity(book.querySelector('.journal-back-shade')!, [[0, .4], [.7, .4], [open, 0], [1, 0]])
  for (const edge of book.querySelectorAll('.journal-edge')) {
    visibility(edge, pickup, 'hidden', 'visible')
    opacity(edge, [[0, 1], [pickup, 1], [.6, 0], [1, 0]])
  }
  const crop = (amount: number) => `inset(0px 0px ${amount}px 0px round 7px 14px 13px 7px)`
  for (const sheet of [page, gutter]) run(sheet, [
    { offset: 0, clipPath: crop(Math.max(0, target.height - height)) },
    { offset: .62, clipPath: crop(Math.max(0, target.height - height)), easing: swing },
    { offset: open, clipPath: crop(0) }, { offset: 1, clipPath: crop(0) },
  ])
  opacity(gutter, [[0, .8], [pickup, .8], [.9, 0], [1, 0]])
  opacity(room, [[0, 1], [.54, 1], [.87, 0], [1, 0]])
  opacity(scrim, [[0, 0], [.45, .27], [pickup, .27], [.82, 0], [1, 0]])
  opacity(pageShadow, [[0, 0], [.86, 0], [.95, 1], [1, 1]])
  opacity(chrome, [[0, 0], [.85, 0], [1, 1]])
  if (focus.shadow) run(focus.shadow, [
    { offset: 0, opacity: 1, scale: '1', easing: glide },
    { offset: .26, opacity: 0, scale: '1.5' }, { offset: 1, opacity: 0, scale: '1.5' },
  ])

  let frame = 0
  let lastPitch: number | undefined
  function paintJacket() {
    if (!stage.isConnected) return
    const progress = movement.effect?.getComputedTiming().progress
    if (typeof progress === 'number' && progress <= pickup) {
      const transform = getComputedStyle(book).transform
      const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform)
      const pitch = Math.atan2(matrix.m23, matrix.m33) * 180 / Math.PI
      if (pitch !== lastPitch) {
        paintProjectedBook(jacket, pitch)
        lastPitch = pitch
      }
    }
    frame = requestAnimationFrame(paintJacket)
  }
  paintJacket()
  return {
    finished: movement.finished,
    cancel() {
      cancelAnimationFrame(frame)
      for (const track of tracks) track.cancel()
    },
  }
}
