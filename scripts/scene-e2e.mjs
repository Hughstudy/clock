import assert from 'node:assert/strict'
import { prepareMinutes } from './focus-duration-actions.mjs'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { holdFocusCard, launchChromium } from './lib/browser.mjs'
import { build, preview } from 'vite'
import react from '@vitejs/plugin-react'

// Isolated browser profiles only. Production accounting is exercised through
// the UI; Playwright's clock advances deadlines without waiting real minutes.
const output = process.env.SCENE_E2E_OUTPUT || await mkdtemp(path.join(tmpdir(), 'clock-scenes-e2e-'))
await mkdir(output, { recursive: true })
process.env.BASE_PATH = '/clock/'
await build({ base: '/clock/' })
const fixtureRoot = path.resolve('preview/animation')
const fixtureDist = path.join(output, 'fixture')
await build({ configFile: false, root: fixtureRoot, base: '/', plugins: [react()], build: { outDir: fixtureDist, emptyOutDir: true } })
const appServer = await preview({ base: '/clock/', preview: { host: '127.0.0.1', port: 0, strictPort: false } })
const fixtureServer = await preview({ configFile: false, root: fixtureRoot, base: '/', build: { outDir: fixtureDist }, preview: { host: '127.0.0.1', port: 0, strictPort: false } })
const appUrl = `http://127.0.0.1:${appServer.httpServer.address().port}/clock/`
const fixtureUrl = `http://127.0.0.1:${fixtureServer.httpServer.address().port}/`
const browser = holdFocusCard(await launchChromium())
const focusPool = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8']
const checks = []
const errors = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const observe = page => {
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
}
const readSaved = page => page.evaluate(() => {
  for (const key of Object.keys(localStorage)) {
    try { const data = JSON.parse(localStorage.getItem(key)); if (data?.timer && Array.isArray(data.records)) return { key, data } } catch { /* other browser keys */ }
  }
  return null
})
async function untilSaved(page, predicate, label) {
  for (let i = 0; i < 80; i++) { const saved = await readSaved(page); if (saved && predicate(saved.data)) return saved.data; await page.waitForTimeout(50) }
  throw new Error(`Timed out waiting for saved state: ${label}`)
}
async function sceneAttribute(page, name) { return page.locator('.home .blue-companion').getAttribute(`data-scene${name ? `-${name}` : ''}`) }
async function endEarly(page) {
  const id = (await readSaved(page)).data.timer.session.id
  await page.getByRole('button', { name: '结束专注', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认结束', exact: true }).click()
  await untilSaved(page, s => s.records.some(record => record.sessionId === id), 'confirmed early end')
}
async function focusReady(page) {
  const back = page.getByRole('button', { name: /^(准备专注|返回专注)$/ })
  if (await back.isVisible()) await back.click()
}

// Select by artwork coordinates so real touch hit testing includes the current
// SVG transforms, foreground props, and the phone layout.
function drawingPoint(part, x, y) {
  return part.evaluate((element, point) => {
    const position = new DOMPoint(...point).matrixTransform(element.getScreenCTM())
    return { x: position.x, y: position.y }
  }, [x, y])
}

// A reading layout that fits the centered creature can still miss the off-center
// tea scene or cover a raised hand. Check each actual assignment at phone scale.
async function inspectSpeech(page, id) {
  const session = (await readSaved(page)).data.timer.session
  if (id === 'F3') {
    const svg = page.locator('.home .blue-companion')
    const table = await drawingPoint(svg.locator('[data-scene-part="table"]'), 160, 193)
    await page.touchscreen.tap(table.x, table.y)
    check('Touching the table in front of the character leaves its pose alone', await svg.getAttribute('data-touch') === '')
  }
  const ask = page.getByRole('button', { name: '给我一句鼓励', exact: true })
  await ask.click()
  const reader = page.getByRole('region', { name: '一句鼓励' })
  await reader.waitFor()
  // Long quotes have their own reading view. Find a short one for the tail check.
  for (let n = 0; n < 14 && await reader.getAttribute('data-location') !== 'scene'; n++) {
    await reader.getByRole('button', { name: '换一句', exact: true }).click()
  }
  await page.clock.runFor(220)
  const geometry = await page.evaluate(() => {
    const speech = document.querySelector('.fp-companion-speech[data-visible="true"]')
    if (!speech) return null
    const b = speech.getBoundingClientRect()
    const h = document.querySelector('[data-scene-part="creature"] [data-part="tuft"]').getBoundingClientRect()
    const art = [...document.querySelectorAll('.home [data-scene-hand]')].map(node => node.getBoundingClientRect())
    const time = document.querySelector('.fp-digits').getBoundingClientRect()
    const tail = getComputedStyle(speech, '::after')
    return { tailX: b.left + parseFloat(tail.left) + 17, headX: h.left + h.width / 2,
      gap: h.top - (b.bottom + 12), belowClock: b.top >= time.bottom - 1,
      clear: art.length === 2 && art.every(r => r.top >= b.bottom || r.right <= b.left || r.left >= b.right) }
  })
  check(`${id}: the speech tail points at this companion and the quote clears its hands and clock`,
    geometry && Math.abs(geometry.tailX - geometry.headX) < 3 && geometry.gap >= 0 && geometry.gap < 11 && geometry.belowClock && geometry.clear)
  await page.screenshot({ path: path.join(output, `reading-${id}.png`), animations: 'disabled' })
  await page.getByRole('button', { name: '收到鼓励了', exact: true }).click()
  const after = (await readSaved(page)).data.timer.session
  check(`${id}: reading leaves the same running session and returns to the plate`,
    session.id === after?.id && after.status === 'running' && await ask.evaluate(el => el === document.activeElement))
  for (const viewport of [{width:320,height:568},{width:430,height:932},{width:375,height:850}]) {
    await page.setViewportSize(viewport)
    await page.clock.runFor(400)
    const cut = await page.evaluate(() => {
      const parts = document.querySelectorAll('.home [data-scene-hand], .home [data-scene-part="kettle"], .home [data-scene-part="plant-pot"], .home [data-scene-part="cup"]')
      return [...parts].filter(el => {
        const r = el.getBoundingClientRect()
        return r.left < -1 || r.right > innerWidth + 1 || r.width === 0
      }).map(el => el.dataset.sceneHand ?? el.dataset.scenePart)
    })
    check(`${id} at ${viewport.width}px: hands and handled pottery fit the scene (${cut.join(', ') || 'clear'})`, !cut.length)
  }
}
try {
  const fixtures = await browser.newPage({ viewport: { width: 1300, height: 1000 } })
  observe(fixtures)
  await fixtures.goto(fixtureUrl)
  await fixtures.locator('[aria-label="All static session activities"]').screenshot({ path: path.join(output, 'scene-gallery.png') })
  await fixtures.getByRole('button', { name: 'Run interaction checks', exact: true }).click()
  await fixtures.locator('[data-result="pass"]').waitFor({ timeout: 25_000 })
  check('Production touch handlers and stable native target: all fixture checks', !(await fixtures.locator('[data-passed="false"]').count()))
  await fixtures.getByRole('button', { name: 'Run scene checks', exact: true }).click()
  await fixtures.locator('[data-scene-result="pass"]').waitFor({ timeout: 25_000 })
  check('All eleven scenes, four tiers, cancellation and replay: all fixture checks', !(await fixtures.locator('[data-passed="false"]').count()))
  const fixtureResults = await fixtures.locator('.preview__result').allTextContents()
  await fixtures.close()

  const context = await browser.newContext({ viewport: { width: 375, height: 850 }, hasTouch: true, timezoneId: 'Asia/Singapore' })
  const page = await context.newPage()
  observe(page)
  await page.clock.install({ time: new Date('2026-10-29T04:00:00Z') })
  await page.goto(appUrl)
  await page.evaluate(() => navigator.serviceWorker.ready)
  const primary = page.locator('.fp-primary .btn-primary')
  const svg = page.locator('.home .blue-companion')
  for (const viewport of [{width:375,height:667}, {width:390,height:844}, {width:430,height:932}]) {
    await page.setViewportSize(viewport)
    await page.clock.runFor(450)
    const windowPoint = await drawingPoint(svg, 65, 50)
    await page.touchscreen.tap(windowPoint.x, windowPoint.y)
    check(`At ${viewport.width}px tapping the window leaves the character alone`, await svg.getAttribute('data-touch') === '')
    const body = svg.locator('[data-part="body"]')
    for (const [part, x, y, expected] of [['head',120,60,'pat'], ['belly',120,138,'squish'], ['left hand',58,117,'high-five'], ['right hand',180,117,'high-five']]) {
      const point = await drawingPoint(body, x, y)
      await page.touchscreen.tap(point.x, point.y)
      check(`At ${viewport.width}px the visible ${part} receives and releases its touch`,
        await svg.getAttribute('data-touch') === expected && await svg.getAttribute('data-touch-phase') === 'release')
      await page.clock.runFor(1400)
    }
  }
  await page.setViewportSize({width:375,height:850})
  await page.clock.runFor(450)
  const beforeStart = await primary.boundingBox()
  await primary.click()
  const initial = await untilSaved(page, s => !!s.timer.session, 'first start')
  const firstId = initial.timer.session.id
  const firstScene = initial.timer.session.scene.sceneId
  const focusScenes = [firstScene]
  check('New focus uses the full shipped pool and v2 selection', focusPool.includes(firstScene) && initial.version === 9 && initial.timer.session.scene.selectionVersion === 2 && await sceneAttribute(page, '') === firstScene)
  check('Permitted start has a scene entrance', await sceneAttribute(page, 'phase') === 'open')
  const afterStart = await primary.boundingBox()
  check('Start and Pause keep the same target', ['x', 'y', 'width', 'height'].every(key => Math.abs(beforeStart[key] - afterStart[key]) < 1))
  await page.clock.fastForward(2100)
  await page.screenshot({ path: path.join(output, 'focus-375.png') })
  await inspectSpeech(page, firstScene)

  const head = await drawingPoint(svg.locator('[data-part="body"]'), 120, 60)
  await page.mouse.move(head.x, head.y)
  await page.mouse.down()
  check('Real pointer contact on the visible scene head responds', await svg.getAttribute('data-touch') === 'pat')
  await page.mouse.up()
  check('Touch leaves session identity intact', (await readSaved(page)).data.timer.session.id === firstId)
  await page.clock.fastForward(2000)
  await primary.click()
  const paused = await untilSaved(page, s => s.timer.session?.status === 'paused', 'pause')
  await page.clock.fastForward(300_000)
  check('Paused time is excluded', (await readSaved(page)).data.timer.session.remainingMs === paused.timer.session.remainingMs)
  await page.reload()
  check('Reload retains paused scene without replay', await sceneAttribute(page, '') === firstScene && await sceneAttribute(page, 'phase') === 'idle')
  await primary.click()
  await untilSaved(page, s => s.timer.session?.status === 'running', 'resume')
  check('Resume retains session and activity', (await readSaved(page)).data.timer.session.id === firstId && await sceneAttribute(page, '') === firstScene)

  await page.getByRole('button', { name: '记下想法', exact: true }).click()
  await page.locator('#thought-text').fill('Scene E2E draft')
  check('Thought editor suspends scene motion', await svg.getAttribute('data-scene-motion') === 'false' && await svg.evaluate(el => el.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running')))
  await page.getByRole('button', { name: '回到计时', exact: true }).click()
  await endEarly(page)
  const early = await untilSaved(page, s => s.records.some(r => r.sessionId === firstId), 'short ending')
  const earlyRecord = early.records.find(r => r.sessionId === firstId)
  check('Short ending records actual elapsed time and retains its scene', earlyRecord.elapsedMs < 60_000 && earlyRecord.scene.sceneId === firstScene && await sceneAttribute(page, '') === firstScene)
  check('Short ending has a complete Hello tableau', await sceneAttribute(page, 'tier') === 'hello')

  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.locator('#duration-focus').fill('1')
  await page.locator('#duration-focus').blur()
  await page.getByRole('button', { name: '回到专注', exact: true }).click()
  await untilSaved(page, s => s.settings.durationsMinutes.focus === 1, 'one minute default')

  // Start from a local input panel: its closure must not consume the entrance.
  await focusReady(page)
  await page.getByRole('button', { name: /这一小步/ }).click()
  await page.locator('.fp-step-input').fill('A small test step')
  await page.locator('.fp-step-input').press('Enter')
  await primary.click()
  await untilSaved(page, s => !!s.timer.session, 'step start')
  check('Typed-step start retains its entrance', await sceneAttribute(page, 'phase') === 'open')
  const stepStart = (await readSaved(page)).data
  focusScenes.push(stepStart.timer.session.scene.sceneId)
  check('Consecutive focus starts differ', focusScenes[1] !== firstScene)
  await inspectSpeech(page, focusScenes[1])
  await endEarly(page)

  // Cover the entire focus bag before a single deadline completion: access
  // comes from the shipped catalogue, never from successful-session thresholds.
  for (let i = 2; i < 8; i++) {
    await focusReady(page)
    await primary.click()
    const started = await untilSaved(page, s => !!s.timer.session, `immediate-access focus ${i + 1}`)
    focusScenes.push(started.timer.session.scene.sceneId)
    check(`Focus ${i + 1} selects a new bag entry`, focusPool.includes(focusScenes[i]) && focusScenes[i] !== focusScenes[i - 1])
    await inspectSpeech(page, focusScenes[i])
    await endEarly(page)
  }
  const beforeDeadline = (await readSaved(page)).data
  check(`All eight focus scenes appear before any full completion (${focusScenes.join(', ')})`,
    new Set(focusScenes).size === 8 && focusPool.every(id => focusScenes.includes(id)) &&
    beforeDeadline.timer.completedFocusCount === 0 && beforeDeadline.records.length === 8 && beforeDeadline.records.every(r => r.endReason === 'manual'))
  check('Immediate access creates no grants, introductions or notice claims',
    beforeDeadline.scenes.unlocked.length === 0 && beforeDeadline.scenes.introduced.length === 0 && beforeDeadline.scenes.announced.length === 0)

  let lastScene = focusScenes.at(-1)
  for (let success = 1; success <= 4; success++) {
    await focusReady(page)
    await primary.click()
    const active = await untilSaved(page, s => s.timer.session?.status === 'running', `deadline focus ${success}`)
    const selected = active.timer.session.scene.sceneId
    check(`Deadline focus ${success} keeps random variety without adjacent repeats`, selected !== lastScene && active.timer.session.scene.selectionVersion === 2)
    lastScene = selected
    await page.clock.fastForward(60_100)
    const completed = await untilSaved(page, s => s.records.filter(r => r.endReason === 'deadline').length === success, `deadline ${success}`)
    check(`Deadline ${success} settles once and preserves scene availability`,
      completed.timer.session === null && completed.scenes.unlocked.length === 0 && completed.scenes.announced.length === 0)
    if (success === 1) {
      check('One-minute completion has its factual Snack ending', await sceneAttribute(page, 'tier') === 'snack')
      const settledRevision = completed.revision
      await page.clock.fastForward(4000)
      check('Quiet time schedules no unlock notice or claim write',
        !(await page.getByText(/伙伴有了新活动/).isVisible()) &&
        (await readSaved(page)).data.revision === settledRevision)
      await page.reload()
      check('Reload never replays an ending or access notice',
        !(await page.getByText(/伙伴有了新活动/).isVisible()) && await sceneAttribute(page, 'phase') === 'idle')
    }
  }
  check('Four full focus sessions still suggest a long break', (await readSaved(page)).data.timer.phase === 'longBreak')

  await focusReady(page)
  await primary.click()
  const finalActive = await untilSaved(page, s => !!s.timer.session, 'cross-tab focus start')
  const finalScene = finalActive.timer.session.scene.sceneId
  check('Later sessions retain full-pool selection without an immediate repeat', focusPool.includes(finalScene) && finalScene !== lastScene)
  const second = await context.newPage()
  observe(second)
  await second.clock.install({ time: new Date(await page.evaluate(() => Date.now())) })
  await second.goto(appUrl)
  check('Another tab agrees on the running scene without an entrance', await sceneAttribute(second, '') === finalScene && await sceneAttribute(second, 'phase') === 'idle')
  check('Another tab has no scene-access notices', !(await second.getByText(/伙伴有了新活动/).isVisible()))
  await second.close()
  await page.bringToFront()

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 850 })
    check(`${width}px layout has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const badge = await page.locator('.fp-digits').boundingBox()
    const controls = await primary.boundingBox()
    check(`${width}px clock and primary control remain readable`, badge.x >= 0 && badge.x + badge.width <= width && controls.x >= 0 && controls.x + controls.width <= width)
    await page.screenshot({ path: path.join(output, `scene-${width}.png`) })
  }
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  check('200% text has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  check('Enlarged text keeps the primary action on screen', await primary.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }))
  await page.screenshot({ path: path.join(output, 'text-200.png'), fullPage: true })
  await page.reload()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  check('OS reduced motion keeps scene with no active animation', await sceneAttribute(page, '') === finalActive.timer.session.scene.sceneId && await svg.evaluate(el => el.getAnimations({ subtree: true }).length === 0))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('switch', { name: '伙伴小场景', exact: true }).uncheck()
  await page.getByRole('button', { name: '回到专注', exact: true }).click()
  check('Scene variety off retains the plain companion', await sceneAttribute(page, '') === '' && await svg.locator('[data-scenery]').count() === 0)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('switch', { name: '伙伴小场景', exact: true }).check()
  await page.getByRole('switch', { name: '伙伴动画', exact: true }).uncheck()
  await page.getByRole('button', { name: '回到专注', exact: true }).click()
  check('Restoring variety retains assignment; app motion off is static', await sceneAttribute(page, '') === finalScene && await svg.evaluate(el => el.getAnimations({ subtree: true }).length === 0))
  await endEarly(page)
  const focusRecords = (await readSaved(page)).data.records.length
  const restScenes = []
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await focusReady(page)
      await page.getByRole('button', { name: '选择休息', exact: true }).click()
    }
    await page.getByRole('button', { name: /^(开始休息|休息 \d+ 分钟)$/ }).click()
    const rest = await untilSaved(page, s => s.timer.phase !== 'focus' && !!s.timer.session, 'rest start')
    restScenes.push(rest.timer.session.scene.sceneId)
    await inspectSpeech(page, rest.timer.session.scene.sceneId)
    await page.getByRole('button', { name: '结束休息', exact: true }).click()
    await untilSaved(page, s => s.timer.phase === 'focus' && !s.timer.session, 'rest ending')
    check(`Rest ${i + 1} ends without a focus tier`, await sceneAttribute(page, 'tier') === '')
  }
  check(`Rest activities rotate independently (${restScenes.join(', ')})`, new Set(restScenes).size === 3)
  check('Rest never adds focus records', (await readSaved(page)).data.records.length === focusRecords)

  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('switch', { name: '伙伴动画', exact: true }).check()
  await page.getByRole('button', { name: '回到专注', exact: true }).click()
  await focusReady(page)
  await prepareMinutes(page, 5)
  check('Choosing the duration leaves the timer ready', !(await readSaved(page)).data.timer.session)
  await primary.click()
  await untilSaved(page, s => !!s.timer.session, 'duration chooser start')
  check('Duration-choice start retains its entrance', await sceneAttribute(page, 'phase') === 'open')
  await primary.focus()
  await page.keyboard.press('Space')
  await untilSaved(page, s => s.timer.session?.status === 'paused', 'keyboard pause')
  check('Keyboard activation remains usable during animation', await primary.evaluate(el => el === document.activeElement))

  const beforeOffline = (await readSaved(page)).data.timer.session
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // ensure this page is controlled by the installed worker
  await context.setOffline(true)
  await page.reload()
  check('Offline reload preserves the paused scene', await sceneAttribute(page, '') === beforeOffline.scene.sceneId && await sceneAttribute(page, 'phase') === 'idle')
  await context.setOffline(false)
  check('One main live region handles companion announcements', await page.locator('[aria-live]').count() === 1)
  check('No browser runtime or console errors', errors.length === 0)
  const report = { browser: browser.version(), userAgent: await page.evaluate(() => navigator.userAgent), checks, fixtureResults, errors, output }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`E2E passed: ${checks.length} app checks plus ${fixtureResults.join('; ')}. Artifacts: ${output}`)
} catch (error) {
  for (const [i, page] of browser.contexts().flatMap(c => c.pages()).entries()) {
    await page.screenshot({ path: path.join(output, `failure-${i}.png`), fullPage: true }).catch(() => {})
    console.error(await page.locator('body').innerText().catch(() => 'Page unavailable'))
  }
  console.error('Browser errors:', errors, 'Artifacts:', output)
  throw error
} finally {
  await browser.close()
  await Promise.all([new Promise(resolve => appServer.httpServer.close(resolve)), new Promise(resolve => fixtureServer.httpServer.close(resolve))])
}
