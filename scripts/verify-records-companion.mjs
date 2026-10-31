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
  const prepare = page.getByRole('button', { name: '回到准备', exact: true })
  if (await prepare.isVisible()) await prepare.click()
  if (step) {
    await page.locator('.step-toggle').click()
    await page.locator('.step-input').fill(step)
    await press(page, '用作这一小步')
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
  await press(page, '结束这段')
  await press(page, '结束并记录')
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
  await press(other, '专注')
  await press(other, '设置')
  await other.getByRole('switch', { name: '伙伴动画' }).uncheck()
  await other.waitForFunction(k => JSON.parse(localStorage.getItem(k)).settings.motionEnabled === false, key)
  await openRecords(other, 'morning')
  check('The app motion switch alone keeps the greeting illustration and disables its gesture',
    await other.locator(`${header} svg`).isVisible() && await other.locator(header).getAttribute('data-animate') === 'false' &&
    await other.locator(header).evaluate(node => node.getAnimations({ subtree: true }).length === 0))
  await press(other, '专注')
  await press(other, '设置')
  await other.getByRole('switch', { name: '伙伴小场景' }).uncheck()
  await openRecords(other, 'morning')
  const otherStory = row(other, latest).locator('button[aria-expanded]')
  if (await otherStory.getAttribute('aria-expanded') !== 'true') await otherStory.click()
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
    await legacy.locator('.stats .stat-value').count() === 0 && await legacy.getByRole('button', { name: '查看趋势' }).count() === 0)

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

  const calendarContext = await browser.newContext({ timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' })
  const calendar = await calendarContext.newPage()
  observe(calendar)
  await calendar.clock.setFixedTime(at('21:15:40'))
  const instant = date => Date.parse(date + 'T12:00:00+08:00')
  const entry = (id, day, elapsedMs) => ({
    ...saved.records[0], sessionId: id, dateKey: day, elapsedMs, startedAt: instant(day) - elapsedMs,
    endedAt: instant(day), endReason: 'manual', step: null,
  })
  const note = (id, dateKey, text, sessionId = null) => ({
    id, dateKey, createdAt: instant(dateKey), text, sessionId, rev: 1, status: 'open', deletedAt: null,
  })
  const sample = {
    ...saved, timer: { ...saved.timer, phase: 'focus', session: null }, scenes: { ...saved.scenes, lastEnded: null },
    records: [entry('oct24', '2026-10-24', 3000), entry('small-b', '2026-10-25', 600),
      entry('small-a', '2026-10-25', 600), entry('oct31', '2026-10-31', 0)],
    thoughts: [note('long-ago', '2026-09-01', '九月的念头'), note('solo', '2026-10-27', '独立想法'),
      note('linked', '2026-10-24', '跨日想法', 'small-a')],
  }
  await calendar.addInitScript(({ k, data }) => {
    if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(data))
  }, { k: key, data: sample })
  await calendar.goto(url)
  await start(calendar, 'ongoing-bd07')
  await openRecords(calendar, 'night')
  const amount = calendar.locator('.stats .stat-value')
  check('BD07 includes Oct 25 through 31 and keeps the active session separate', await amount.innerText() === '1 秒' &&
    await calendar.getByText('2026-10-25 至 2026-10-31', { exact: true }).isVisible() &&
    await calendar.getByText(/正在计时，未计入/).isVisible() && !await row(calendar, 'oct24').count())
  const group = calendar.locator('.record-day[data-date="2026-10-25"]')
  check('Two 600 ms entries each display below one second and the day sums to one second', (await group.locator('h4').innerText()).includes('1 秒') &&
    await group.getByText('不到 1 秒', { exact: true }).count() === 2 &&
    await group.locator('[data-record-id]').first().getAttribute('data-record-id') === 'small-a')
  check('Independent thought appears on its own zero-time date without duplicating a linked thought',
    await calendar.locator('[data-date="2026-10-27"] [data-thought-id="solo"]').isVisible() &&
    !await calendar.locator('[data-thought-id="linked"]').count())
  await row(calendar, 'small-a').locator('.record-summary').click()
  check('A cross-day thought retains its original date inside the session', (await row(calendar, 'small-a').innerText()).includes('2026-10-24 · 跨日想法'))
  await press(calendar, '查看更早记录')
  check('Earlier entries are explicitly outside the total', await row(calendar, 'oct24').isVisible() &&
    await calendar.getByText('更早记录，不计入上方范围汇总。', { exact: true }).isVisible() && await amount.innerText() === '1 秒')
  await press(calendar, '近30天')
  check('The 30-day window switches both date boundaries and total', await amount.innerText() === '4 秒' &&
    await calendar.getByText('2026-10-02 至 2026-10-31', { exact: true }).isVisible())
  await calendar.setViewportSize({ width: 375, height: 450 })
  await calendar.evaluate(() => window.scrollTo(0, 220))
  await calendar.waitForFunction(() => window.scrollY === 220)
  const recordsOffset = await calendar.evaluate(() => window.scrollY)
  await press(calendar, '只看想法')
  const oldNote = calendar.locator('[data-thought-id="long-ago"]')
  await oldNote.locator('button[aria-expanded]').click()
  check('All-time thoughts include a September entry and hide focus totals', await oldNote.isVisible() && !await amount.count())
  const editNote = oldNote.getByRole('button', { name: '编辑文字', exact: true })
  await editNote.click()
  const editor = calendar.getByRole('dialog', { name: '编辑想法' })
  await editor.getByRole('textbox').fill('九月的念头，已补充')
  await editor.getByRole('button', { name: '保存想法', exact: true }).click()
  await editor.waitFor({ state: 'hidden' })
  check('Editing a September note in Records updates the same identity and returns focus to its open entry',
    (await snapshot(calendar)).thoughts.find(t => t.id === 'long-ago').text === '九月的念头，已补充' &&
    await oldNote.locator('button[aria-expanded]').getAttribute('aria-expanded') === 'true' &&
    await editNote.evaluate(el => el === document.activeElement) && await calendar.locator('.stats').isVisible())
  await press(calendar, '全部记录')
  check('Returning to history preserves the selected range and expanded session', await calendar.getByRole('button', { name: '近30天' }).getAttribute('aria-pressed') === 'true' &&
    await row(calendar, 'small-a').locator('.record-summary').getAttribute('aria-expanded') === 'true')
  check('A mode switch restores the prior history scroll offset', Math.abs(await calendar.evaluate(() => window.scrollY) - recordsOffset) <= 1)
  await press(calendar, '只看想法')
  await press(calendar, '专注')
  await openRecords(calendar, 'night')
  check('Returning from Focus restores the thought mode and original open note', await oldNote.locator('button[aria-expanded]').getAttribute('aria-expanded') === 'true' &&
    !await amount.count())
  await calendar.reload()
  await openRecords(calendar, 'night')
  check('A cold navigation opens all records with the seven-day window', await calendar.getByRole('button', { name: '近7天' }).getAttribute('aria-pressed') === 'true' &&
    await row(calendar, 'small-a').locator('.record-summary').getAttribute('aria-expanded') === 'false')
  const peer = await calendarContext.newPage()
  observe(peer)
  await peer.clock.setFixedTime(at('21:16:40'))
  await peer.goto(url)
  await press(calendar, '专注')
  await timeOfDay(calendar, '21:16:40')
  await calendar.evaluate(k => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === k) throw new DOMException('Pause write failed', 'QuotaExceededError')
      return original.call(this, name, value)
    }
    window.restorePauseWrite = () => { Storage.prototype.setItem = original }
  }, key)
  await calendar.locator('.home .btn-primary').click()
  const retry = calendar.getByRole('button', { name: '重试保存', exact: true }).first()
  await retry.waitFor()
  await press(peer, '设置')
  await peer.getByRole('switch', { name: '伙伴动画' }).uncheck()
  await peer.waitForFunction(k => JSON.parse(localStorage.getItem(k)).settings.motionEnabled === false, key)
  await calendar.evaluate(() => window.restorePauseWrite())
  await retry.click()
  await calendar.waitForFunction(k => JSON.parse(localStorage.getItem(k)).timer.session?.status === 'paused', key)
  await timeOfDay(calendar, '21:19:40')
  await end(calendar)
  await calendar.waitForFunction(k => JSON.parse(localStorage.getItem(k)).records.some(r => r.sessionId === 'ongoing-bd07'), key)
  const recovered = await snapshot(calendar)
  check('A failed pause survives an independent settings write from a real second tab and excludes the next three minutes',
    recovered.settings.motionEnabled === false && recovered.records.filter(r => r.sessionId === 'ongoing-bd07' && r.elapsedMs === 60_000).length === 1)
  await calendarContext.close()

  assert.deepEqual(errors, [], 'Unexpected browser errors')
  const report = { browser: browser.version(), platform: process.platform, widths, checks, errors, screenshot: 'records-night-375.png' }
  await writeFile(path.join(output, 'browser-review.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`${checks.length} Records checks passed in Chromium ${report.browser}. Evidence: ${output}`)
} finally {
  await browser?.close()
  await app.close()
}
