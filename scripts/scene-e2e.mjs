import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
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
const browser = await chromium.launch({ headless: true, ...(process.env.SCENE_BROWSER_CHANNEL ? { channel: process.env.SCENE_BROWSER_CHANNEL } : {}) })
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
  await page.getByRole('button', { name: '结束这段', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '结束并记录', exact: true }).click()
  await untilSaved(page, s => s.records.some(record => record.sessionId === id), 'confirmed early end')
}
async function focusReady(page) {
  const back = page.getByRole('button', { name: /^(回到准备|回到专注准备|专注模式)$/ })
  if (await back.isVisible()) await back.click()
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

  const context = await browser.newContext({ viewport: { width: 375, height: 850 }, timezoneId: 'Asia/Singapore' })
  const page = await context.newPage()
  observe(page)
  await page.clock.install({ time: new Date('2026-10-29T04:00:00Z') })
  await page.goto(appUrl)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.getByText('已准备好离线使用。', { exact: true }).waitFor()
  await page.getByRole('button', { name: '知道了', exact: true }).click()
  const primary = page.locator('.controls .btn-primary')
  const beforeStart = await primary.boundingBox()
  await primary.click()
  const initial = await untilSaved(page, s => !!s.timer.session, 'first start')
  const firstId = initial.timer.session.id
  const firstScene = initial.timer.session.scene.sceneId
  const focusScenes = [firstScene]
  check('New focus uses the full shipped pool and v2 selection', focusPool.includes(firstScene) && initial.version === 7 && initial.timer.session.scene.selectionVersion === 2 && await sceneAttribute(page, '') === firstScene)
  check('Permitted start has a scene entrance', await sceneAttribute(page, 'phase') === 'open')
  const afterStart = await primary.boundingBox()
  check('Start and Pause keep the same target', ['x', 'y', 'width', 'height'].every(key => Math.abs(beforeStart[key] - afterStart[key]) < 1))
  await page.clock.fastForward(2100)
  await page.screenshot({ path: path.join(output, 'focus-375.png') })

  const svg = page.locator('.home .blue-companion')
  const bounds = await svg.boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * 130 / 190)
  await page.mouse.down()
  check('Real pointer belly contact responds', await svg.getAttribute('data-touch') === 'squish')
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

  await page.getByRole('button', { name: '写想法', exact: true }).click()
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
  await page.getByRole('button', { name: '关闭设置，回到专注', exact: true }).click()
  await untilSaved(page, s => s.settings.durationsMinutes.focus === 1, 'one minute default')

  // Start from a local input panel: its closure must not consume the entrance.
  await focusReady(page)
  await page.getByRole('button', { name: /这一小步/ }).click()
  await page.locator('.step-input').fill('A small test step')
  await page.locator('.step-input').press('Enter')
  await primary.click()
  await untilSaved(page, s => !!s.timer.session, 'step start')
  check('Typed-step start retains its entrance', await sceneAttribute(page, 'phase') === 'open')
  const stepStart = (await readSaved(page)).data
  focusScenes.push(stepStart.timer.session.scene.sceneId)
  check('Consecutive focus starts differ', focusScenes[1] !== firstScene)
  await endEarly(page)

  // Cover the entire focus bag before a single deadline completion: access
  // comes from the shipped catalogue, never from successful-session thresholds.
  for (let i = 2; i < 8; i++) {
    await focusReady(page)
    await primary.click()
    const started = await untilSaved(page, s => !!s.timer.session, `immediate-access focus ${i + 1}`)
    focusScenes.push(started.timer.session.scene.sceneId)
    check(`Focus ${i + 1} selects a new bag entry`, focusPool.includes(focusScenes[i]) && focusScenes[i] !== focusScenes[i - 1])
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
        !(await page.locator('.companion-feedback__content').getByText(/伙伴有了新活动/).isVisible()) &&
        (await readSaved(page)).data.revision === settledRevision)
      await page.reload()
      check('Reload never replays an ending or access notice',
        !(await page.locator('.companion-feedback__content').getByText(/伙伴有了新活动/).isVisible()) && await sceneAttribute(page, 'phase') === 'idle')
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
  check('Another tab has no scene-access notices', !(await second.locator('.companion-feedback__content').getByText(/伙伴有了新活动/).isVisible()))
  await second.close()
  await page.bringToFront()

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 850 })
    check(`${width}px layout has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const badge = await page.locator('.clock-badge').boundingBox()
    const controls = await primary.boundingBox()
    check(`${width}px clock and primary control remain readable`, badge.x >= 0 && badge.x + badge.width <= width && controls.x >= 0 && controls.x + controls.width <= width)
    await page.screenshot({ path: path.join(output, `scene-${width}.png`) })
  }
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  check('200% text has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  check('Enlarged feedback stays below the character and props', await page.locator('.companion-feedback__content').evaluate(el => el.getBoundingClientRect().top >= document.querySelector('.home .blue-companion').getBoundingClientRect().bottom - 1))
  await page.screenshot({ path: path.join(output, 'text-200.png'), fullPage: true })
  await page.reload()

  await page.emulateMedia({ reducedMotion: 'reduce' })
  check('OS reduced motion keeps scene with no active animation', await sceneAttribute(page, '') === finalActive.timer.session.scene.sceneId && await svg.evaluate(el => el.getAnimations({ subtree: true }).length === 0))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('switch', { name: '伙伴小场景', exact: true }).uncheck()
  await page.getByRole('button', { name: '关闭设置，回到专注', exact: true }).click()
  check('Scene variety off retains the plain companion', await sceneAttribute(page, '') === '' && await svg.locator('[data-scenery]').count() === 0)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('switch', { name: '伙伴小场景', exact: true }).check()
  await page.getByRole('switch', { name: '伙伴动画', exact: true }).uncheck()
  await page.getByRole('button', { name: '关闭设置，回到专注', exact: true }).click()
  check('Restoring variety retains assignment; app motion off is static', await sceneAttribute(page, '') === finalScene && await svg.evaluate(el => el.getAnimations({ subtree: true }).length === 0))
  await endEarly(page)
  const focusRecords = (await readSaved(page)).data.records.length
  const restScenes = []
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await focusReady(page)
      await page.getByRole('button', { name: '休息模式', exact: true }).click()
    }
    await page.getByRole('button', { name: /^开始休息/ }).click()
    const rest = await untilSaved(page, s => s.timer.phase !== 'focus' && !!s.timer.session, 'rest start')
    restScenes.push(rest.timer.session.scene.sceneId)
    await page.getByRole('button', { name: '结束休息', exact: true }).click()
    await untilSaved(page, s => s.timer.phase === 'focus' && !s.timer.session, 'rest ending')
    check(`Rest ${i + 1} ends without a focus tier`, await sceneAttribute(page, 'tier') === '')
  }
  check(`Rest activities rotate independently (${restScenes.join(', ')})`, new Set(restScenes).size === 3)
  check('Rest never adds focus records', (await readSaved(page)).data.records.length === focusRecords)

  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('switch', { name: '伙伴动画', exact: true }).check()
  await page.getByRole('button', { name: '关闭设置，回到专注', exact: true }).click()
  await focusReady(page)
  await page.getByRole('button', { name: '选时长', exact: true }).click()
  await page.getByRole('button', { name: '5 分钟', exact: true }).click()
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
