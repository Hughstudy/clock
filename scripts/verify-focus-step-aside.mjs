import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { webkit } from 'playwright'
import { build, preview } from 'vite'
import { launchChromium } from './lib/browser.mjs'

const output = path.resolve(process.env.STEP_ASIDE_OUTPUT || '.preview/focus-step-aside')
const outDir = path.join(output, 'build')
const checks = [], errors = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const tap = (page, name) => button(page, name).click()
const handle = page => page.locator('.fp-handle')
// A short real-time limit: the fake clock keeps flowing, so a long wait would hide a late card.
const home = (page, chrome) => page.locator(`.home[data-chrome="${chrome}"]`).waitFor({ state: 'attached', timeout: 1500 })
const screen = (page, name) => page.locator(`.app[data-screen="${name}"]`).waitFor()
const settled = page => page.evaluate(async () => {
  await document.fonts.ready
  for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame)
})
const running = page => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot'))?.timer.session?.status)

async function open(browser, url, viewport, name, errorsLabel, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(`${errorsLabel} ${name}: ${error.message}`))
  await page.clock.install({ time: new Date('2026-11-09T10:30:00') })
  await page.goto(url)
  await screen(page, 'home')
  await button(page, '开始专注').waitFor()
  return { context, page }
}

async function start(page) {
  await tap(page, '开始专注')
  await button(page, '暂停专注').waitFor()
}

async function stepAside(page) {
  await page.clock.fastForward(4200)
  await home(page, 'away')
  await handle(page).waitFor()
  await settled(page)
}

async function callOutFromRoom(page) {
  await page.mouse.click(12, 180)
  await home(page, 'shown')
  await page.clock.fastForward(400)
  await page.waitForFunction(() => document.querySelector('.home').dataset.arriving === 'false')
}

const controlsBox = page => page.locator('.fp-controls').boundingBox()
const sameBox = (a, b) => ['x', 'y', 'width', 'height'].every(key => Math.abs(a[key] - b[key]) <= 1)

/** Every size: the card leaves, the scene stays clear of the handle and time, and the card returns. */
async function layout(browser, url, label, viewport) {
  const name = `${viewport.width}×${viewport.height}`
  const { context, page } = await open(browser, url, viewport, name, label)
  const before = await controlsBox(page)
  check(`${label} ${name}: the card is on screen when ready`, await page.locator('.home[data-chrome="shown"]').count() === 1 && await handle(page).count() === 0)
  await start(page)
  const justStarted = await controlsBox(page)
  check(`${label} ${name}: starting keeps the controls in place`, sameBox(before, justStarted))
  await page.clock.fastForward(3000)
  check(`${label} ${name}: the card stays for the first seconds`, await button(page, '暂停专注').isVisible())
  await stepAside(page)
  check(`${label} ${name}: pause and tabs leave when the card steps aside`, !(await page.locator('.fp-controls').isVisible()) && !(await page.locator('.tab-bar').isVisible()))
  check(`${label} ${name}: settings leaves with the card`, !(await page.locator('.fp-top').isVisible()))
  check(`${label} ${name}: the time stays`, await page.locator('.fp-digits').isVisible())
  const box = await handle(page).boundingBox()
  check(`${label} ${name}: the handle is at least 44px`, box.width >= 44 && box.height >= 44)
  check(`${label} ${name}: the first session explains the handle`, await page.locator('.fp-handle-hint').isVisible())
  const shape = await page.evaluate(() => {
    const rect = element => element.getBoundingClientRect()
    const hint = rect(document.querySelector('.fp-handle-hint'))
    const clock = rect(document.querySelector('.fp-digits'))
    const tuft = document.querySelector('.blue-companion__tuft, [data-scene-part="creature"] [data-part="tuft"]')
    const hit = ({ x, y }) => document.elementFromPoint(x, y)?.closest('.fp-controls, .tab-bar')
    return { hintLeft: hint.left, hintRight: hint.right, tuftTop: rect(tuft).top, clockBottom: clock.bottom, width: innerWidth, blocked: !!hit({ x: innerWidth / 2, y: innerHeight - 40 }) }
  })
  check(`${label} ${name}: the head stays below the time`, shape.tuftTop >= shape.clockBottom)
  check(`${label} ${name}: the hint fits the screen`, shape.hintLeft >= 0 && shape.hintRight <= shape.width)
  check(`${label} ${name}: hidden controls can't be tapped`, !shape.blocked)
  await callOutFromRoom(page)
  await settled(page)
  check(`${label} ${name}: the card returns to its exact place`, sameBox(before, await controlsBox(page)))
  await context.close()
}

/** Full behaviour on one phone and one iPad size. */
async function behaviour(browser, url, label, viewport) {
  const name = `${viewport.width}×${viewport.height}`
  const { context, page } = await open(browser, url, viewport, name, label)
  await start(page)
  await stepAside(page)

  const pat = await page.evaluate(() => {
    for (const part of document.querySelectorAll('[data-touch-kind]')) {
      const box = part.getBoundingClientRect()
      for (let fx = .2; fx < 1; fx += .2) for (let fy = .2; fy < 1; fy += .2) {
        const x = box.left + box.width * fx, y = box.top + box.height * fy
        if (document.elementFromPoint(x, y)?.closest('[data-touch-kind]')) return { x, y }
      }
    }
    return null
  })
  await page.mouse.click(pat.x, pat.y)
  await settled(page)
  check(`${label} ${name}: patting the companion leaves the card away`, await page.locator('.home[data-chrome="away"]').count() === 1)

  await callOutFromRoom(page)
  check(`${label} ${name}: tapping the room calls the card back`, await button(page, '暂停专注').isVisible())
  check(`${label} ${name}: a call-out doesn't change the timer`, await running(page) === 'running')
  await page.clock.fastForward(5000)
  check(`${label} ${name}: the card stays while recently called`, await button(page, '暂停专注').isVisible())
  await page.clock.fastForward(3400)
  await home(page, 'away')
  check(`${label} ${name}: the card leaves again when untouched`, true)

  const point = await handle(page).boundingBox()
  await page.mouse.dblclick(point.x + point.width / 2, point.y + point.height / 2)
  await home(page, 'shown')
  await page.clock.fastForward(400)
  check(`${label} ${name}: a double tap on the handle presses nothing else`, await running(page) === 'running' && await page.locator('.app[data-screen="home"]').count() === 1)

  await tap(page, '记下想法')
  await button(page, '回到计时').waitFor()
  await page.clock.fastForward(30000)
  check(`${label} ${name}: an open note holds the card`, await page.locator('.home[data-chrome="shown"]').count() === 1)
  await tap(page, '回到计时')
  await page.clock.fastForward(7000)
  check(`${label} ${name}: closing a task restarts the wait`, await page.locator('.home[data-chrome="shown"]').count() === 1)
  await page.clock.fastForward(1400)
  await home(page, 'away')

  await callOutFromRoom(page)
  await tap(page, '留个标记')
  await page.locator('.fp-note .text-action').first().waitFor()
  await page.clock.fastForward(8400)
  check(`${label} ${name}: a mark's confirmation holds the card`, await page.locator('.home[data-chrome="shown"]').count() === 1)
  await page.clock.fastForward(11000)
  await settled(page)
  await page.clock.fastForward(8400)
  await home(page, 'away')
  check(`${label} ${name}: the card leaves once the confirmation ends`, true)
  await callOutFromRoom(page)
  check(`${label} ${name}: the mark's undo is still in the card`, await page.locator('.fp-note .text-action').first().isVisible())
  await page.clock.fastForward(8400)
  await home(page, 'away')

  await handle(page).focus()
  await page.keyboard.press('Enter')
  await home(page, 'shown')
  await page.waitForFunction(() => document.activeElement?.closest('.fp-primary'))
  await page.clock.fastForward(400)
  check(`${label} ${name}: the keyboard moves into the returned card`, true)
  await page.clock.fastForward(30000)
  check(`${label} ${name}: keyboard focus holds the card`, await page.locator('.home[data-chrome="shown"]').count() === 1)
  await page.evaluate(() => document.activeElement.blur())
  await page.clock.fastForward(8400)
  await home(page, 'away')

  await callOutFromRoom(page)
  await tap(page, '暂停专注')
  await button(page, '继续专注').waitFor()
  await page.clock.fastForward(30000)
  check(`${label} ${name}: paused keeps the card`, await button(page, '继续专注').isVisible())
  await tap(page, '继续专注')
  await button(page, '暂停专注').waitFor()
  await stepAside(page)
  check(`${label} ${name}: resuming lets the card leave again`, true)

  await callOutFromRoom(page)
  await button(page, '记录').click()
  await screen(page, 'stats')
  await page.clock.fastForward(30000)
  check(`${label} ${name}: Records keeps its tabs during a session`, await page.locator('.tab-bar').isVisible())
  await button(page, '专注').click()
  await screen(page, 'home')
  check(`${label} ${name}: returning shows the card`, await button(page, '暂停专注').isVisible())
  await page.clock.fastForward(8400)
  await home(page, 'away')

  await callOutFromRoom(page)
  await tap(page, '结束专注')
  await button(page, '确认结束').waitFor()
  if (viewport.width > viewport.height) {
    await settled(page)
    const gap = await page.evaluate(() => document.querySelector('.fp-plate').getBoundingClientRect().left + 12 - document.querySelector('.focus-panel[open]').getBoundingClientRect().right)
    check(`${label} ${name}: the end confirmation stays beside the card`, gap >= 0)
  }
  await tap(page, '确认结束')
  await button(page, '准备专注').waitFor()
  await page.clock.fastForward(30000)
  check(`${label} ${name}: the ended result keeps the card`, await button(page, '准备专注').isVisible())

  for (const session of [2, 3, 4]) {
    await tap(page, '准备专注')
    await start(page)
    await stepAside(page)
    const hinted = await page.locator('.fp-handle-hint').isVisible()
    check(`${label} ${name}: session ${session} ${session <= 3 ? 'still explains' : 'no longer explains'} the handle`, hinted === (session <= 3))
    await callOutFromRoom(page)
    await tap(page, '结束专注')
    await tap(page, '确认结束')
    await button(page, '准备专注').waitFor()
  }
  await context.close()
}

const scenes = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'R1', 'R2', 'R3']

const readScene = page => page.evaluate(() => {
  const box = element => { const b = element.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom } }
  const one = selector => { const element = document.querySelector(selector); return element ? box(element) : null }
  const plate = document.querySelector('.fp-plate').getBoundingClientRect()
  return {
    scene: document.querySelector('.blue-companion').dataset.scene, chrome: document.querySelector('.home').dataset.chrome, width: innerWidth,
    arms: one('[data-scene-part="arms"]'), creature: one('[data-scene-part="creature"]'), hint: one('.fp-handle-hint'), handle: one('.fp-handle'),
    tuft: one('.blue-companion__tuft, [data-scene-part="creature"] [data-part="tuft"]'), digits: one('.fp-digits'), cardLeft: plate.left + 12, cardTop: plate.top,
  }
})
const overlaps = (a, b) => !!a && !!b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

/** Every activity at the start, middle and end of a session, with full motion. */
async function everyScene(browser, url, label, viewport) {
  const name = `${viewport.width}×${viewport.height}`
  const landscape = viewport.width > viewport.height
  const { context, page } = await open(browser, url, viewport, name, label, 'no-preference')
  await start(page)
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('whale-focus:snapshot') ?? '{}').timer?.session?.scene)
  const problems = []
  for (const scene of scenes) for (const progress of [0.06, 0.5, 0.94]) {
    await page.evaluate(({ scene, progress }) => {
      const key = 'whale-focus:snapshot'
      const snapshot = JSON.parse(localStorage.getItem(key))
      const session = snapshot.timer.session
      snapshot.timer.phase = scene.startsWith('R') ? 'shortBreak' : 'focus'
      session.scene = { ...session.scene, sceneId: scene }
      session.durationMs = 1500000
      session.deadline = Date.now() + session.durationMs * (1 - progress)
      snapshot.revision += 1
      localStorage.setItem(key, JSON.stringify(snapshot))
    }, { scene, progress })
    await page.reload()
    await page.waitForFunction(id => document.querySelector('.blue-companion')?.dataset.scene === id, scene)
    await page.clock.runFor(900)
    await page.waitForTimeout(520)
    const shown = await readScene(page)
    await page.clock.fastForward(4300)
    await home(page, 'away')
    await page.waitForTimeout(520)
    const away = await readScene(page)
    const where = `${scene} at ${progress}`
    if (landscape && shown.arms && shown.arms.r > shown.cardLeft && shown.arms.b > shown.cardTop) problems.push(`${where}: a hand is under the card`)
    if (away.arms && (away.arms.l < 0 || away.arms.r > away.width)) problems.push(`${where}: a hand leaves the screen`)
    if (away.tuft.t < away.digits.b) problems.push(`${where}: the head reaches the time`)
    for (const [item, part] of [['handle', away.handle], ['hint', away.hint]]) {
      if (overlaps(part, away.arms) || overlaps(part, away.creature)) problems.push(`${where}: the ${item} covers the companion`)
    }
  }
  assert.deepEqual(problems, [], `${label} ${name}`)
  check(`${label} ${name}: every scene keeps hands, head, handle and hint clear`, true)
  await context.close()
}

async function neverSteps(browser, url, label) {
  const { context, page } = await open(browser, url, { width: 844, height: 390 }, 'short landscape', label)
  await start(page)
  await page.clock.fastForward(30000)
  await settled(page)
  check(`${label}: short phone landscape keeps the card`, await page.locator('.home[data-chrome="shown"]').count() === 1)
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
  await page.waitForFunction(() => document.querySelector('.home')?.dataset.layout === 'readable')
  await page.clock.fastForward(30000)
  await settled(page)
  check(`${label}: the large-text layout keeps the card`, await page.locator('.home[data-chrome="shown"]').count() === 1)
  await context.close()
}

process.env.BASE_PATH = '/clock/'
await mkdir(output, { recursive: true })
await build({ build: { outDir } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
const versions = {}
const sizes = [[320, 640], [375, 812], [430, 932], [744, 1133], [820, 1180], [1180, 820], [1024, 768]]
try {
  for (const [label, launch] of [['chrome', launchChromium], ['webkit', () => webkit.launch()]]) {
    const browser = await launch()
    try {
      versions[label] = browser.version()
      for (const [width, height] of sizes) await layout(browser, url, label, { width, height })
      for (const [width, height] of [[375, 812], [1180, 820]]) await behaviour(browser, url, label, { width, height })
      if (label === 'chrome') for (const [width, height] of [[1180, 820], [1024, 768], [820, 1180], [375, 812]]) await everyScene(browser, url, label, { width, height })
      await neverSteps(browser, url, label)
    } finally {
      await browser.close()
    }
  }
  check('No browser errors', errors.length === 0)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ versions, checks, errors, physicalDevice: false }, null, 2))
  console.log(`${checks.length} checks passed`)
} finally {
  await new Promise(resolve => server.httpServer.close(resolve))
}
