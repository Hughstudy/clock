import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { webkit } from 'playwright'
import { build, preview } from 'vite'
import { launchChromium } from './lib/browser.mjs'

const triggerSelector = '#root .home [data-scene-book-trigger]'
const stageSelector = '.scene-fold-stage'
const button = (page, name) => page.getByRole('button', { name, exact: true })
const snapshot = page => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')))
const noFlight = page => page.locator(stageSelector).waitFor({ state: 'detached' })
const isNear = (a, b) => Math.abs(a - b) < 2
const matchRect = (actual, expected, label) => {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert(isNear(actual[key], expected[key]), `${label} ${key}: ${actual[key]} vs ${expected[key]}`)
  }
}

// Stop just the journal's presentation clock so the first and final frames can
// be compared to the real screens. Timer actions and React run normally.
function observeFlights() {
  const animate = Element.prototype.animate
  window.journalTracks = []
  Element.prototype.animate = function (...args) {
    const track = animate.apply(this, args)
    if (this.closest('.scene-fold-stage') || this.getRootNode().host?.closest('.scene-fold-stage')) {
      window.journalTracks.push(track)
      if (window.holdJournal) track.pause()
    }
    return track
  }
}

async function seek(page, fraction) {
  await page.evaluate(async fraction => {
    for (const track of window.journalTracks) track.currentTime = fraction * track.effect.getTiming().duration
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }, fraction)
}

async function hold(page) {
  await page.evaluate(() => {
    window.journalTracks = []
    window.holdJournal = true
  })
}

async function release(page) {
  await page.evaluate(() => {
    for (const track of window.journalTracks) track.finish()
    window.holdJournal = false
    window.journalTracks = []
  })
  await noFlight(page)
}

async function inspectPlacement(page) {
  const geometry = await page.locator(triggerSelector).evaluate(trigger => {
    const cover = trigger.querySelector('[data-scene-book-cover]').getBoundingClientRect()
    const target = trigger.getBoundingClientRect()
    const x = cover.x + cover.width / 2
    const y = cover.y + cover.height / 2
    const eyes = document.querySelector('#root .home [data-focus-rig="eyes"]').getBoundingClientRect()
    return {
      cover: cover.toJSON(), width: target.width, height: target.height, id: trigger.dataset.bookScene,
      hit: trigger.contains(document.elementFromPoint(x, y)),
      inView: cover.left >= -.5 && cover.right <= innerWidth + .5 && cover.top >= 0 && cover.bottom <= innerHeight,
      clear: eyes.right < cover.left || eyes.left > cover.right || eyes.bottom < cover.top || eyes.top > cover.bottom,
    }
  })
  assert(geometry.hit && geometry.inView && geometry.clear && geometry.width >= 43.5 && geometry.height >= 43.5,
    'visible reachable book clears the face: ' + JSON.stringify(geometry))
  return geometry
}

async function screenshotRegion(page, rect) {
  const clip = {
    x: Math.ceil(rect.x), y: Math.ceil(rect.y),
    width: Math.floor(rect.width) - 1, height: Math.floor(rect.height) - 1,
  }
  return (await page.screenshot({ clip, scale: 'css' })).toString('base64')
}

async function comparePaint(page, before, after, label, tolerance) {
  const difference = await page.evaluate(async images => {
    const [a, b] = await Promise.all(images.map(async bytes => {
      const image = new Image()
      image.src = 'data:image/png;base64,' + bytes
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0)
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data
    }))
    let changed = 0
    for (let i = 0; i < a.length; i += 4) {
      if (Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])) > 32) changed++
    }
    return changed / (a.length / 4)
  }, [before, after])
  assert(difference < tolerance, `${label}: ${(difference * 100).toFixed(1)}% changed pixels`)
}

async function inspectOpening(page, origin, source) {
  const before = await screenshotRegion(page, source.cover)
  await hold(page)
  await origin.click()
  const stage = page.locator(stageSelector)
  await stage.locator('.journal-block').waitFor({ state: 'attached' })
  assert(await stage.evaluate(el => el.inert && el.getAttribute('aria-hidden') === 'true'))
  assert(await page.locator('#stats-title').evaluate(el => document.activeElement === el))
  await seek(page, 0)
  await comparePaint(page, before, await screenshotRegion(page, source.cover), source.id + ' first moving cover', .19)
  await seek(page, .48)
  const held = await stage.locator('.scene-fold-closed [data-scene-book-cover]').boundingBox()
  assert(held.width > source.cover.width, 'closed book comes forward before the hinge opens')
  await seek(page, .74)
  const hinge = await stage.locator('.journal-hinge').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m11)
  assert(hinge < .5, 'cover has turned away on its spine')
  const liveBook = page.locator('#root .rj-book')
  const target = await liveBook.boundingBox()
  await seek(page, .998)
  matchRect(await stage.locator('.scene-fold-page').boundingBox(), target, 'full-size printed page')
  // External production stylesheets must style the inert paper too. Include
  // the ribbons, heading and actual reading content in the comparison.
  const printed = await screenshotRegion(page, target)
  await release(page)
  await comparePaint(page, printed, await screenshotRegion(page, target), 'arriving Records paper', .08)
}

async function inspectReturn(page, home, source) {
  const target = await page.locator('#root .rj-book').boundingBox()
  await hold(page)
  await home.click()
  const stage = page.locator(stageSelector)
  await stage.locator('.journal-block').waitFor({ state: 'attached' })
  await seek(page, 0)
  matchRect(await stage.locator('.scene-fold-page').boundingBox(), target, 'return begins at open Records')
  await seek(page, .999)
  matchRect(await stage.locator('.scene-fold-closed [data-scene-book-cover]').boundingBox(), source.cover,
    source.id + ' moving cover lands on its support')
  await release(page)
}

async function checkResponsivePlacement(page, prop, home) {
  for (const [width, height, fontSize] of [[320, 568, 32], [375, 812, 16], [430, 932, 16], [740, 390, 16]]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(async size => {
      document.documentElement.style.fontSize = size + 'px'
      for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame)
    }, fontSize)
    await inspectPlacement(page)
    await prop.click()
    await page.locator('#root .rj-book').waitFor()
    await home.click()
    await noFlight(page)
  }
}

async function review(browser, url) {
  const errors = []
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, locale: 'zh-CN', reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(observeFlights)
  await page.clock.setSystemTime(new Date('2026-11-24T15:00:00+08:00'))
  await page.goto(url)
  const prop = page.locator(triggerSelector)
  const records = button(page, '记录'), home = button(page, '专注')
  const stage = page.locator(stageSelector)

  // The first ever press must animate, with real chapter actions available.
  await hold(page)
  await records.click()
  await stage.waitFor()
  const thoughts = page.getByRole('tab', { name: '想法', exact: true })
  await thoughts.click()
  await noFlight(page)
  assert.equal(await thoughts.getAttribute('aria-selected'), 'true')
  await page.evaluate(() => { window.holdJournal = false })
  await home.click()
  await noFlight(page)

  const scenes = new Set()
  for (let i = 0; i < 11; i++) {
    const rest = i >= 8
    if (rest) {
      await button(page, '选择休息').click()
      await page.getByRole('button', { name: /^(开始休息|休息 \d+ 分钟)$/ }).click()
    } else {
      await button(page, '开始专注').click()
    }
    await button(page, rest ? '暂停休息' : '暂停专注').click()
    await button(page, rest ? '继续休息' : '继续专注').waitFor()
    const session = (await snapshot(page)).timer.session
    const source = await inspectPlacement(page)
    assert.equal(source.id, session.scene.sceneId)
    scenes.add(source.id)
    const origin = i % 2 ? records : prop
    const sampleMotion = ['F4', 'F6', 'R2'].includes(source.id)
    if (sampleMotion) {
      await inspectOpening(page, origin, source)
    } else {
      await origin.click()
      await stage.waitFor()
      await records.click() // A second activation settles immediately.
      await noFlight(page)
    }
    if (sampleMotion) {
      await inspectReturn(page, home, source)
    } else {
      await home.click()
      await stage.waitFor()
      await noFlight(page)
    }
    const landed = await inspectPlacement(page)
    assert.equal(landed.id, source.id)
    matchRect(landed.cover, source.cover, source.id + ' returns to its placement')
    assert.deepEqual((await snapshot(page)).timer.session, session, source.id + ' paused session survives opening and return')
    await button(page, rest ? '结束休息' : '结束专注').click()
    if (!rest) await button(page, '确认结束').click()
    const prepare = button(page, '准备专注')
    if (!rest) await prepare.waitFor()
    if (await prepare.isVisible()) await prepare.click()
  }
  assert.deepEqual([...scenes].sort(), ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'R1', 'R2', 'R3'])

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await checkResponsivePlacement(page, prop, home)
  await page.setViewportSize({ width: 390, height: 844 })
  await button(page, '开始专注').click()
  await page.locator('.home[data-chrome="away"]').waitFor({ timeout: 8000 })
  await inspectPlacement(page)
  const running = (await snapshot(page)).timer.session
  await page.evaluate(() => { window.journalTracks = [] })
  await prop.focus()
  await prop.press('Enter')
  await page.locator('#root .rj-book').waitFor()
  assert(await page.locator('#stats-title').evaluate(el => document.activeElement === el))
  await home.click()
  assert.equal(await page.evaluate(() => window.journalTracks.length), 0, 'reduced motion switches directly')
  assert.deepEqual((await snapshot(page)).timer.session, running, 'running identity, deadline and activity survive')
  assert.deepEqual(errors, [])
  console.log(`PASS ${browser.browserType().name()} ${browser.version()}: 11 journal placements and round trips, printed pages and covers, first press, interruption, 320/375/430px and landscape layouts, 200% text, keyboard, reduced motion and timer continuity`)
}

process.env.BASE_PATH = '/clock/'
const outDir = await mkdtemp(path.join(tmpdir(), 'clock-journal-'))
let browser
let server
try {
  await build({ build: { outDir, emptyOutDir: true }, logLevel: 'warn' })
  server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
  browser = process.env.IOS_BROWSER === 'webkit' ? await webkit.launch() : await launchChromium()
  await review(browser, `http://127.0.0.1:${server.httpServer.address().port}/clock/`)
} finally {
  await browser?.close()
  if (server) await new Promise(resolve => server.httpServer.close(resolve))
  await rm(outDir, { recursive: true, force: true })
}
