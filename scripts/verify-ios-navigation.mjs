import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { webkit } from 'playwright'
import { holdFocusCard, launchChromium } from './lib/browser.mjs'
import { build, preview } from 'vite'

const output = path.resolve(process.env.NAVIGATION_REVIEW_OUTPUT || '.preview/ios-navigation')
const outDir = path.join(output, 'build')
const checks = [], errors = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const screen = (page, name) => page.locator(`.app[data-screen="${name}"]`).waitFor()
const snapshot = page => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')))

async function readTabLayout(page) {
  return page.evaluate(async () => {
    await document.fonts.ready
    // Allow the resize observer and its scheduled layout update to finish.
    for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame)
    const bar = document.querySelector('.tab-bar')
    const controls = document.querySelector('.fp-controls').getBoundingClientRect()
    const boxes = [bar, ...bar.querySelectorAll('button')].map(element => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    })
    return { boxes, controlsCenter: controls.x + controls.width / 2, viewportCenter: innerWidth / 2 }
  })
}

function sameTabBounds(previous, current) {
  return previous.boxes.length === current.boxes.length && previous.boxes.every((box, index) =>
    Object.keys(box).every(key => Math.abs(box[key] - current.boxes[index][key]) <= 1))
}

async function checkTabletNavigation(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1194, height: 834 }, hasTouch: true, reducedMotion: 'reduce' })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(url)
    await screen(page, 'home')
    let regularLandscape, enlargedLandscape
    for (const [width, height, fontSize] of [[1194, 834, null], [1194, 700, null], [834, 1194, null], [1194, 834, 32]]) {
      await page.setViewportSize({ width, height })
      await page.evaluate(size => { document.documentElement.style.fontSize = size ? `${size}px` : '' }, fontSize)
      const focus = await readTabLayout(page)
      const bar = focus.boxes[0]
      const landscape = width > height
      const expectedCenter = landscape ? focus.controlsCenter : focus.viewportCenter
      const label = `${width}×${height} ${fontSize ? 'enlarged' : 'default'} text`
      check(`${label}: Focus tabs center on ${landscape ? 'the right-hand controls' : 'the viewport'}`,
        (!landscape || focus.controlsCenter > focus.viewportCenter) && Math.abs(bar.x + bar.width / 2 - expectedCenter) <= 1)
      await button(page, '记录').click()
      await screen(page, 'stats')
      check(`${label}: both tab targets keep their bounds on Records`, sameTabBounds(focus, await readTabLayout(page)))
      await button(page, '专注').click()
      await screen(page, 'home')
      check(`${label}: returning to Focus keeps both tab targets in place`, sameTabBounds(focus, await readTabLayout(page)))
      if (width === 1194 && height === 834) {
        if (fontSize) enlargedLandscape = focus
        else regularLandscape = focus
      }
    }

    await button(page, '记录').click()
    await screen(page, 'stats')
    await page.reload()
    await screen(page, 'stats')
    check('Reloading directly into iPad Records keeps the default landscape tab positions', sameTabBounds(regularLandscape, await readTabLayout(page)))
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
    check('Increasing text size within Records aligns tabs while Focus is hidden', sameTabBounds(enlargedLandscape, await readTabLayout(page)))
    await button(page, '专注').click()
    await screen(page, 'home')
    check('Opening Focus after resizing text within Records keeps the same enlarged tab positions', sameTabBounds(enlargedLandscape, await readTabLayout(page)))
  } finally {
    await page.close()
  }
}

process.env.BASE_PATH = '/clock/'
await mkdir(output, { recursive: true })
await build({ build: { outDir } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
let browser
try {
  browser = holdFocusCard(process.env.IOS_BROWSER === 'webkit' ? await webkit.launch() : await launchChromium())
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('data:text/html,<title>Previous page</title>Previous page')
  await page.goto(url)
  await screen(page, 'home')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await button(page, '设置').click()
  await screen(page, 'settings')
  check('Settings receives heading focus', await page.locator('#settings-title').evaluate(el => document.activeElement === el))
  await page.getByText('应用状态', { exact: true }).click()
  check('Offline readiness stays available in Settings while Focus stays quiet', await page.getByText('已准备好离线使用。', { exact: true }).isVisible())
  await page.goBack()
  await screen(page, 'home')
  check('Browser Back returns from Settings to its opener', await button(page, '设置').evaluate(el => document.activeElement === el))
  check('Offline readiness adds no Focus attention chip', await page.locator('.fp-note').isHidden())
  await page.goForward()
  await screen(page, 'settings')
  await button(page, '‹ 回到专注').click()
  await screen(page, 'home')
  await page.waitForFunction(() => history.state?.clockScreen === 'home')
  await page.goBack()
  check('Explicit Settings return consumes its entry and Home Back leaves the app', await page.title() === 'Previous page')
  await page.goForward()
  await screen(page, 'home')
  await button(page, '开始专注').click()
  await button(page, '暂停专注').waitFor()
  const running = await snapshot(page)
  await button(page, '记录').click()
  await screen(page, 'stats')
  check('Records receives heading focus', await page.locator('#stats-title').evaluate(el => document.activeElement === el))
  await page.reload()
  await screen(page, 'stats')
  check('Reload keeps the current screen and running session identity', (await snapshot(page)).timer.session.id === running.timer.session.id)
  await page.locator('.records-status-button').click()
  await page.getByRole('dialog').waitFor()
  await page.waitForFunction(() => history.state?.clockFocusTask === true)
  await page.goBack()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  check('Back from Records status restores its opener across browser focus conventions', await page.locator('.records-status-button').evaluate(el => document.activeElement === el))
  await button(page, '选择月份').click()
  await page.getByRole('dialog').getByRole('spinbutton').fill('1999')
  await page.waitForFunction(() => history.state?.clockFocusTask === true)
  await page.goBack()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  check('Back closes the month draft before leaving Records', await page.locator('.app').getAttribute('data-screen') === 'stats' && await button(page, '选择月份').evaluate(el => document.activeElement === el))
  await page.goForward()
  await page.waitForFunction(() => history.state?.clockFocusTask !== true)
  check('Forward skips a dismissed panel without reopening input or adding an extra Back', await page.locator('.app').getAttribute('data-screen') === 'stats' && await page.getByRole('dialog').count() === 0)
  await page.goBack()
  await screen(page, 'home')
  check('A second Back returns to Focus without changing the timer', (await snapshot(page)).timer.session.id === running.timer.session.id && (await snapshot(page)).timer.session.status === 'running')

  await button(page, '记下想法').click()
  await page.locator('#thought-text').fill('导航保留的草稿')
  await button(page, '记录').click()
  await screen(page, 'stats')
  check('The open editor transfers to Records with its input', await page.locator('#thought-text').inputValue() === '导航保留的草稿')
  await page.goBack()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  check('Back closes the transferred editor on Records', await page.locator('.app').getAttribute('data-screen') === 'stats')
  await page.goBack()
  await screen(page, 'home')
  await button(page, '继续草稿').click()
  check('Returning to Focus preserves the unsent draft', await page.locator('#thought-text').inputValue() === '导航保留的草稿')
  await page.waitForFunction(() => history.state?.clockFocusTask === true)
  await page.reload()
  await screen(page, 'home')
  await page.waitForFunction(() => history.state?.clockFocusTask !== true)
  check('Reload retires the old task entry without reopening the keyboard', await page.getByRole('dialog').count() === 0)
  await button(page, '继续草稿').click()
  check('A reloaded task keeps its recoverable draft', await page.locator('#thought-text').inputValue() === '导航保留的草稿')
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.waitForFunction(() => history.state?.clockFocusTask !== true)

  await button(page, '设置').click()
  await screen(page, 'settings')
  await page.evaluate(() => {
    document.querySelector('.settings-header button').click()
    document.querySelector('.tab[data-tab="stats"]').click()
  })
  await screen(page, 'stats')
  await page.waitForFunction(() => history.state?.clockScreen === 'stats')
  await page.goBack()
  await screen(page, 'home')
  check('A rapid Settings return followed by Records keeps a valid Back destination', true)
  check('Navigation leaves accounting unchanged', (await snapshot(page)).timer.session.id === running.timer.session.id && (await snapshot(page)).records.length === running.records.length)

  const settingsPage = await context.newPage()
  settingsPage.on('pageerror', error => errors.push(error.message))
  await settingsPage.goto(url)
  await button(settingsPage, '设置').click()
  await settingsPage.locator('#duration-focus').fill('37')
  await settingsPage.goBack()
  await screen(settingsPage, 'home')
  await settingsPage.waitForFunction(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')).settings.durationsMinutes.focus === 37)
  await settingsPage.reload()
  check('Browser Back commits a valid focused Settings duration before unmount and reload', (await snapshot(settingsPage)).settings.durationsMinutes.focus === 37)
  assert.deepEqual((await snapshot(settingsPage)).timer.session, running.timer.session)
  check('Committing Settings on Back preserves the active timer', true)

  await button(settingsPage, '设置').click()
  await settingsPage.locator('#duration-focus').fill('999')
  await settingsPage.goBack()
  await screen(settingsPage, 'home')
  await button(settingsPage, '设置').click()
  check('Browser Back preserves an invalid duration draft without changing the saved setting',
    await settingsPage.locator('#duration-focus').inputValue() === '999' &&
    await settingsPage.locator('#duration-focus').getAttribute('aria-invalid') === 'true' &&
    (await snapshot(settingsPage)).settings.durationsMinutes.focus === 37)

  await settingsPage.locator('#duration-focus').fill('38')
  await settingsPage.evaluate(() => document.querySelector('.settings-header button').click())
  await screen(settingsPage, 'home')
  await settingsPage.waitForFunction(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')).settings.durationsMinutes.focus === 38)
  check('Explicit return also commits a focused valid field without relying on pointer focus', true)
  await button(settingsPage, '设置').click()
  await settingsPage.locator('#duration-focus').fill('39')
  await settingsPage.evaluate(() => document.querySelector('.tab[data-tab="stats"]').click())
  await screen(settingsPage, 'stats')
  await settingsPage.waitForFunction(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')).settings.durationsMinutes.focus === 39)
  check('Tab navigation commits a focused valid field through the same path', true)
  await checkTabletNavigation(browser, url)
  check('No browser page errors', errors.length === 0)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors, physicalDevice: false }, null, 2))
  await context.close()
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
