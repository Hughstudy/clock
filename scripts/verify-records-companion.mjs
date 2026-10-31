import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { build, preview } from 'vite'

const output = path.resolve(process.env.RECORDS_REVIEW_OUTPUT || '.preview/records-companion')
const outDir = path.resolve('.preview/records-companion-build')
const key = 'whale-focus:snapshot'
const url = 'http://127.0.0.1:4387/clock/'
const checks = []
const errors = []
const widths = [320, 375, 430]
const header = '.records-greeting'
const row = (page, id) => page.locator(`.focus-records > li[data-record-id="${id}"]`)
const press = (page, name) => page.getByRole('button', { name, exact: true }).click()
const snapshot = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)
const at = time => new Date(`2026-10-31T${time}+08:00`)

function check(description, value) {
  assert.ok(value, description)
  checks.push(description)
}

async function timeOfDay(page, time) {
  await page.clock.setFixedTime(at(time))
  // Wake the production hour reader even if the page is currently idle.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

async function openRecords(page, band) {
  await press(page, '记录')
  await page.locator(`${header}[data-band="${band}"]`).waitFor()
}

async function start(page, sessionId, step) {
  if (step) {
    await page.locator('.step-toggle').click()
    await page.locator('.step-input').fill(step)
  }
  // Supply the next session ID only, so each real start selects a reproducible story.
  await page.evaluate(id => {
    crypto.randomUUID = () => { delete crypto.randomUUID; return id }
  }, sessionId)
  await page.locator('.home .btn-primary').click()
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k))?.timer.session, key)
  assert.equal((await snapshot(page)).timer.session.id, sessionId)
  return sessionId
}

async function end(page) {
  await press(page, '结束并记录')
  await press(page, '确认结束并记录')
}

function observe(page) {
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
}

await mkdir(output, { recursive: true })
process.env.BASE_PATH = '/clock/'
await build({ build: { outDir } })
const app = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 4387, strictPort: true } })
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.SCENE_BROWSER_EXECUTABLE, channel: process.env.SCENE_BROWSER_CHANNEL })
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, colorScheme: 'light' })
  context.on('page', observe)
  const page = await context.newPage()
  const localDevice = await context.newCDPSession(page)
  await localDevice.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Singapore' })
  await page.clock.setFixedTime(at('05:59:59'))
  await page.goto(url)
  const dismiss = page.getByRole('button', { name: '知道了', exact: true })
  if (await dismiss.isVisible()) await dismiss.click()

  for (const [time, band, boundary, next] of [
    ['05:59:59', 'night', '06:00:00', 'morning'],
    ['11:59:59', 'morning', '12:00:00', 'afternoon'],
    ['16:59:59', 'afternoon', '17:00:00', 'evening'],
    ['20:59:59', 'evening', '21:00:00', 'night'],
  ]) {
    await timeOfDay(page, time)
    await openRecords(page, band)
    await page.waitForFunction(selector => document.querySelector(selector)?.getAnimations({ subtree: true }).some(a => a.playState === 'running'), header)
    check(`Deliberate ${band} visit starts a real CSS gesture`, await page.locator(`${header} svg`).isVisible())
    await page.waitForFunction(selector => !document.querySelector(selector).getAnimations({ subtree: true }).some(a => a.playState === 'running'), header)
    await page.locator(`${header}[data-animate="false"]`).waitFor()
    await press(page, '记录')
    await timeOfDay(page, boundary)
    await page.locator(`${header}[data-band="${next}"][data-animate="false"]`).waitFor()
    check(`Repeated tab selection and ${boundary} boundary keep ${next} settled`,
      !await page.locator(header).evaluate(node => node.getAnimations({ subtree: true }).some(a => a.playState === 'running')))
    await press(page, '专注')
  }

  await openRecords(page, 'night')
  await page.waitForFunction(selector => document.querySelector(selector).getAnimations({ subtree: true }).some(a => a.playState === 'running'), header)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  await page.locator(`${header}[data-animate="false"]`).waitFor()
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  check('Hiding the page during a gesture cancels it and returning does not replay it',
    await page.locator(header).getAttribute('data-animate') === 'false' &&
    await page.locator(header).evaluate(node => !node.getAnimations({ subtree: true }).some(a => a.playState === 'running')))
  await press(page, '专注')

  await timeOfDay(page, '21:15:00')
  const zero = await start(page, '31f470f8-c370-49bd-844b-cd175ab9d4d0')
  await end(page)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).records.length === 1, key)
  const first = await start(page, '31f470f8-c370-49bd-844b-cd175ab9d4d3', '读一页书')
  await timeOfDay(page, '21:15:20')
  await end(page)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).records.length === 2, key)
  const latest = await start(page, '31f470f8-c370-49bd-844b-cd175ab9d4d1', '写下一句话')
  await page.clock.setFixedTime(at('21:15:40'))
  await page.evaluate(k => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === k) throw new DOMException('Test quota failure', 'QuotaExceededError')
      return original.call(this, name, value)
    }
    window.restoreRecordWrites = () => { Storage.prototype.setItem = original }
  }, key)
  await end(page)
  await page.getByRole('button', { name: '重试保存' }).waitFor()
  await openRecords(page, 'night')
  const failed = row(page, latest)
  await failed.locator('button[aria-expanded]').click()
  check('Quota failure preserves the timed row, withholds its story and keeps earlier stories visible',
    await failed.getAttribute('data-saved') === 'false' && !await failed.getAttribute('data-story-id') &&
    await failed.locator('.record-story').count() === 0 && (await failed.innerText()).includes('20 秒') &&
    !(await failed.innerText()).includes('已保存') && !!await row(page, first).getAttribute('data-story-id') &&
    (await snapshot(page)).records.length === 2)
  await page.evaluate(() => window.restoreRecordWrites())
  await press(page, '重试保存')
  await page.locator(`li[data-record-id="${latest}"][data-saved="true"] .record-story`).waitFor()
  const saved = await snapshot(page)
  check('Retry saves the same identity once with the exact duration', saved.records.length === 3 &&
    saved.records.filter(r => r.sessionId === latest && r.elapsedMs === 20_000).length === 1)
  check('Two 20-second records total 40 seconds, including a separately visible zero-second entry',
    (await page.locator('.stat-value').first().innerText()).includes('40 秒') &&
    (await row(page, zero).innerText()).includes('已开始过这一段') && !!await row(page, zero).getAttribute('data-story-id'))
  const story = await failed.getAttribute('data-story-id')
  check('The three native session identities consistently select star, leaf and map',
    await row(page, zero).getAttribute('data-story-id') === 'star' && await row(page, first).getAttribute('data-story-id') === 'leaf' && story === 'map')
  check('Expanded story has a readable caption and illustration', (await failed.locator('.record-story').innerText()).trim().length > 6 &&
    await failed.locator('.record-story svg').isVisible() && (await failed.innerText()).includes('已保存'))

  const toggle = row(page, first).locator('button[aria-expanded]')
  await toggle.focus()
  await page.keyboard.press('Enter')
  check('Keyboard opens one entry, keeps focus on its button and closes the prior entry',
    await toggle.getAttribute('aria-expanded') === 'true' && await toggle.evaluate(el => el === document.activeElement) &&
    await failed.locator('button[aria-expanded]').getAttribute('aria-expanded') === 'false')
  await failed.locator('button[aria-expanded]').click()
  const initialRecord = saved.records.find(r => r.sessionId === latest)
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    check(`Expanded Records fits ${width} CSS pixels`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.setViewportSize({ width: 320, height: 900 })
  const fontStyle = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  check('Expanded Records fits 320 CSS pixels with 200% text', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await fontStyle.evaluate(el => el.remove())
  await page.setViewportSize({ width: 375, height: 930 })
  if (await dismiss.isVisible()) await dismiss.click()
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0) })
  await page.screenshot({ path: path.join(output, 'records-night-375.png') })
  check('Browsing and expanding records creates no writes', (await snapshot(page)).revision === saved.revision)

  const other = await context.newPage()
  const travelingDevice = await context.newCDPSession(other)
  await travelingDevice.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Singapore' })
  await other.clock.setFixedTime(at('21:15:40'))
  await other.goto(url)
  await other.emulateMedia({ reducedMotion: 'reduce' })
  await openRecords(other, 'night')
  check('Reduced motion shows the settled scene without animation',
    await other.locator(`${header} svg`).isVisible() && await other.locator(header).getAttribute('data-animate') === 'false' &&
    await other.locator(header).evaluate(el => el.getAnimations({ subtree: true }).length === 0))
  check('Another tab reads the same story and historical date',
    await row(other, latest).getAttribute('data-story-id') === story && (await row(other, latest).innerText()).includes(initialRecord.dateKey))
  await other.reload()
  await openRecords(other, 'night')
  check('Reload keeps the story without announcing a past success',
    await row(other, latest).getAttribute('data-story-id') === story && !(await other.locator('.sr-only[aria-live]').innerText()))
  await travelingDevice.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' })
  await other.evaluate(() => window.dispatchEvent(new Event('focus')))
  // Singapore 21:15 is Los Angeles 06:15 on the test date.
  await other.locator(`${header}[data-band="morning"][data-animate="false"]`).waitFor()
  check('Travel changes the room while the saved story and date remain fixed',
    await row(other, latest).getAttribute('data-story-id') === story && (await row(other, latest).innerText()).includes(initialRecord.dateKey))
  await other.emulateMedia({ reducedMotion: 'no-preference' })
  await press(other, '设置')
  await other.getByRole('switch', { name: '伙伴动画' }).uncheck()
  await other.waitForFunction(k => JSON.parse(localStorage.getItem(k)).settings.motionEnabled === false, key)
  await openRecords(other, 'morning')
  check('The app motion switch alone keeps the greeting illustration and disables its gesture',
    await other.locator(`${header} svg`).isVisible() && await other.locator(header).getAttribute('data-animate') === 'false' &&
    await other.locator(header).evaluate(node => node.getAnimations({ subtree: true }).length === 0))
  await press(other, '设置')
  await other.getByRole('switch', { name: '伙伴小场景' }).uncheck()
  await openRecords(other, 'morning')
  await row(other, latest).locator('button[aria-expanded]').click()
  check('Scene art can be hidden while entry facts and story text stay readable',
    await other.locator(`${header} svg`).count() === 0 && await row(other, latest).locator('.records-art').count() === 0 &&
    (await row(other, latest).locator('.record-story').innerText()).trim().length > 6 && (await row(other, latest).innerText()).includes('20 秒'))
  await page.locator(`${header} svg`).waitFor({ state: 'detached' })
  check('Cross-tab preference sync keeps the open story and never replays the entrance',
    await failed.locator('button[aria-expanded]').getAttribute('aria-expanded') === 'true' &&
    await failed.getAttribute('data-story-id') === story && await page.locator(header).getAttribute('data-animate') === 'false')

  const legacy = await browser.newPage({ timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' })
  observe(legacy)
  await legacy.clock.setFixedTime(at('21:15:40'))
  const knownStories = new Map([['legacy-qa-0', 'map'], ['legacy-qa-1', 'leaf'], ['legacy-qa-3', 'star']])
  const legacySnapshot = {
    ...saved, version: 5, records: [...knownStories.keys()].map((id, index) => ({
      ...saved.records[index], scene: undefined, source: 'legacy', startedAt: null, sessionId: id,
    })), participations: saved.participations.map((p, index) => ({ ...p, sessionId: [...knownStories.keys()][index] })),
    scenes: { ...saved.scenes, lastEnded: null },
  }
  await legacy.addInitScript(({ storageKey, data }) => {
    if (localStorage.getItem(storageKey) === null) localStorage.setItem(storageKey, JSON.stringify(data))
  }, { storageKey: key, data: legacySnapshot })
  await legacy.goto(url)
  await openRecords(legacy, 'night')
  for (const [id, expected] of knownStories) {
    const entry = row(legacy, id)
    await entry.locator('button[aria-expanded]').click()
    check(`Version 5 history shows the original date with its stable ${expected} illustration and caption`,
      await entry.getAttribute('data-story-id') === expected && await entry.locator('.record-story svg').isVisible() &&
      (await entry.locator('.record-story').innerText()).trim().length > 6 &&
      (await entry.innerText()).includes(saved.records[0].dateKey))
  }

  // Exercise a real decode repair in this disposable profile. One valid record survives.
  await legacy.evaluate(k => {
    const data = JSON.parse(localStorage.getItem(k))
    data.records = [data.records[0], { ...data.records[1], elapsedMs: -1 }]
    localStorage.setItem(k, JSON.stringify(data))
  }, key)
  await legacy.reload()
  await openRecords(legacy, 'night')
  const survivor = row(legacy, 'legacy-qa-0')
  await survivor.locator('button[aria-expanded]').click()
  check('A dropped record shows an incomplete-history notice and keeps the surviving saved story readable',
    await legacy.getByText('历史数据未能完整读取。这里只展示当前能确认的内容。', { exact: true }).isVisible() &&
    await legacy.locator('.focus-records > li').count() === 1 && await survivor.getAttribute('data-saved') === 'true' &&
    await survivor.locator('.record-story[data-story-id="map"] figcaption').isVisible())
  check('Incomplete history displays no numeric period totals or weekly trend',
    await legacy.locator('.stats .stat-value').count() === 0 && await legacy.getByText('查看本周投入', { exact: true }).count() === 0)

  // A real origin-wide clear in the second tab sends a storage event with a null key.
  await other.evaluate(() => localStorage.clear())
  await page.getByText(/浏览器中的专注数据已被清除/).waitFor()
  check('A second-tab storage clear removes all saved badges and stories but keeps the local rows readable',
    await page.locator('.focus-records > li[data-saved="false"]').count() === 3 &&
    await page.locator('.focus-records [data-story-id]').count() === 0 &&
    (await failed.innerText()).includes('20 秒') && (await failed.innerText()).includes('仅在此页'))
  await row(page, first).locator('button[aria-expanded]').click()
  await press(page, '专注')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await openRecords(page, 'night')
  check('Returning to the stale tab and browsing records cannot write deleted data back', await snapshot(page) === null)
  await page.reload()
  await openRecords(page, 'night')
  check('Reload after removal opens empty history without resurrecting data',
    await page.locator('.focus-records > li').count() === 0 && await snapshot(page) === null)

  assert.deepEqual(errors, [], 'Unexpected browser errors')
  const report = { browser: browser.version(), platform: process.platform, widths, checks, errors, screenshot: 'records-night-375.png' }
  await writeFile(path.join(output, 'browser-review.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`${checks.length} Records checks passed in Chromium ${report.browser}. Evidence: ${output}`)
} finally {
  await browser?.close()
  await app.close()
}
