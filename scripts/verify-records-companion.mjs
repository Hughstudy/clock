import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { holdFocusCard, launchChromium } from './lib/browser.mjs'
import { build, preview } from 'vite'

const output = path.resolve(process.env.RECORDS_REVIEW_OUTPUT || '.preview/records-v35')
const outDir = path.resolve('.preview/records-v35-build')
const key = 'whale-focus:snapshot'
const url = 'http://127.0.0.1:4387/clock/'
const checks = [], errors = [], scaleResults = []
const widths = [320, 375, 430]
const t0 = Date.parse('2026-11-02T21:15:00+08:00')
const row = (page, id) => page.locator(`.records-list li[data-record-id="${id}"]`)
const press = (page, name) => page.getByRole('button', { name, exact: true }).click()
const snapshot = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)
const check = (description, value) => { assert.ok(value, description); checks.push(description) }
const observe = page => {
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
}
const openRecords = async page => { await press(page, '记录'); await page.locator('.records-v35').waitFor() }
const fixTime = async (page, now) => { await page.clock.setFixedTime(now); await page.evaluate(() => window.dispatchEvent(new Event('focus'))) }
async function start(page) {
  const prepare = page.getByRole('button', { name: '准备专注', exact: true })
  if (await prepare.isVisible()) await prepare.click()
  await press(page, '开始专注')
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k))?.timer.session, key)
  return (await snapshot(page)).timer.session.id
}
async function end(page) { await press(page, '结束专注'); await press(page, '确认结束') }
async function retrySave(page) {
  let retry = page.getByRole('button', { name: '重试保存', exact: true }).first()
  if (!await retry.isVisible()) { await page.locator('.records-status-button').click(); retry = page.getByRole('button', { name: '重试保存', exact: true }).first() }
  await retry.click()
  const status = page.getByRole('dialog', { name: '应用状态', exact: true })
  if (await status.isVisible()) await status.getByRole('button', { name: '返回记录', exact: true }).click()
}
async function failWrites(page) {
  await page.evaluate(k => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === k) throw new DOMException('Records QA quota failure', 'QuotaExceededError')
      return original.call(this, name, value)
    }
    window.restoreRecordWrites = () => { Storage.prototype.setItem = original }
  }, key)
}
async function seedPage(browser, sample) {
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' })
  const page = await context.newPage()
  observe(page)
  await page.clock.setFixedTime(t0)
  await page.addInitScript(({ k, data }) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(data)) }, { k: key, data: sample })
  await page.goto(url)
  return { context, page }
}
function makeSample(base, count) {
  const records = Array.from({ length: count }, (_, i) => {
    const endedAt = t0 - i * 3_600_000
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(endedAt)
    return { sessionId: `record-${i}`, startedAt: endedAt - 60_000, endedAt, dateKey, targetMs: 1_500_000, elapsedMs: 60_000, endReason: 'manual', source: 'native', step: `小步骤 ${i}`,
      ...(i % 5 === 0 ? { scene: { sceneId: 'F3', ordinal: i + 1, selectionVersion: 2 } } : {}) }
  })
  const thoughts = Array.from({ length: 210 }, (_, i) => {
    const createdAt = t0 - i * 86_400_000
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(createdAt)
    return { id: `thought-${i}`, createdAt, dateKey, sessionId: null, text: i === 180 ? 'Café A+B. 找回旧念头' : i === 2 ? '' : `正式想法 ${i}`, status: i === 180 ? 'putAway' : 'open', rev: 1, deletedAt: null }
  })
  return { ...base, revision: 50, timer: { ...base.timer, phase: 'focus', session: null }, records, thoughts,
    participations: records.map(record => ({ sessionId: record.sessionId, participatedAt: record.startedAt, dateKey: record.dateKey, source: 'native' })),
    scenes: { ...base.scenes, lastEnded: null }, lastRestEnd: null,
    thoughtDraft: { id: 'draft-qa', thoughtId: null, baseRev: null, sessionId: null, timeZone: 'Asia/Singapore', createdAt: t0, dateKey: '2026-11-02', text: '未提交的草稿，不是搜索结果' }, draftStamp: 'draft-stamp',
    quoteFavorites: [{ id: 'qa-quote', text: '此刻的一小步，也值得被记住。', copyVersion: 'qa1', savedAt: t0, rev: 1, deletedAt: null }] }
}

await mkdir(output, { recursive: true })
process.env.BASE_PATH = '/clock/'
await build({ build: { outDir } })
const app = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 4387, strictPort: true } })
let browser
try {
  browser = holdFocusCard(await launchChromium())
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, timezoneId: 'Asia/Singapore' })
  const page = await context.newPage()
  observe(page)
  await page.clock.setFixedTime(t0)
  await page.goto(url)
  await openRecords(page)
  check('First visit offers the cottage and welcome letter before any memory exists',
    await page.locator('.memory-room-print').isVisible() && await page.locator('.memory-letter').isVisible() &&
    await page.locator('.memory-postcard, .records-summary').count() === 0)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(output, 'records-first-375.png'), animations: 'disabled' })
  await page.locator('.memory-letter').click()
  await page.getByRole('dialog', { name: '欢迎笺' }).getByRole('button', { name: '返回记录' }).click()
  await page.locator('.room-preview').click()
  check('An empty dataset shows the furnished room and no picture tags or fabricated activity', await page.locator('.records-room .records-art').isVisible() && await page.locator('[data-room-spot]').count() === 0 && await page.locator('.records-activity').count() === 0)
  await press(page, '全部记录')
  await press(page, '专注')
  const zero = await start(page)
  await end(page)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).records.length === 1, key)
  const first = await start(page)
  await fixTime(page, t0 + 20_000)
  await end(page)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).records.length === 2, key)
  const latest = await start(page)
  await fixTime(page, t0 + 40_000)
  await failWrites(page)
  await end(page)
  await openRecords(page)
  await row(page, latest).locator('.record-summary').click()
  check('Failed end retains exact pending row, excludes it from formal totals and withholds saved activity',
    await row(page, latest).getAttribute('data-saved') === 'false' &&
    (await row(page, latest).innerText()).includes('20 秒') && await row(page, latest).locator('.record-story').count() === 0 &&
    (await page.locator('.records-summary').innerText()).includes('20 秒') && (await snapshot(page)).records.length === 2)
  await page.getByRole('dialog', { name: '专注手记' }).getByRole('button', { name: '返回记录' }).click()
  await page.evaluate(() => window.restoreRecordWrites())
  await retrySave(page)
  await page.locator(`li[data-record-id="${latest}"][data-saved="true"]`).waitFor()
  const base = await snapshot(page)
  check('Retry records same identity once; zero seconds stays visible and two 20-second segments total40', base.records.length === 3 && base.records.filter(record => record.sessionId === latest).length === 1 &&
    (await row(page, zero).innerText()).includes('已开始过这一段') && (await page.locator('.records-summary').innerText()).includes('40 秒'))
  check('All four modes and a compact cottage preview leave the first record visible with statistics collapsed',
    await page.locator('.records-modes button').count() === 4 && (await page.locator('.room-preview').boundingBox()).height <= 72 &&
    (await row(page, latest).boundingBox()).y < 800 &&
    await page.getByRole('button', { name: '查看统计', exact: true }).getAttribute('aria-expanded') === 'false' && await page.getByRole('button', { name: '近30天', exact: true }).count() === 0)
  const beforePanels = (await snapshot(page)).revision
  await press(page, '选择月份')
  const monthTask = page.getByRole('dialog', { name: '选择月份', exact: true })
  await monthTask.getByRole('spinbutton', { name: '年份', exact: true }).fill('2024')
  await page.waitForFunction(() => history.state?.clockFocusTask === true)
  await page.evaluate(() => history.back())
  await monthTask.waitFor({ state: 'hidden' })
  check('System Back cancels the month picker without applying its draft or leaving Records',
    await page.locator('.records-v35').isVisible() && (await page.locator('.records-filter-row').innerText()).includes('全部日期') && await page.getByRole('button', { name: '选择月份', exact: true }).evaluate(element => element === document.activeElement))
  await page.locator('.records-status-button').click()
  await page.waitForFunction(() => history.state?.clockFocusTask === true)
  await page.evaluate(() => history.back())
  await page.getByRole('dialog', { name: '应用状态', exact: true }).waitFor({ state: 'hidden' })
  check('System Back closes application status, returns focus and creates no business write',
    await page.locator('.records-status-button').evaluate(element => element === document.activeElement) && (await snapshot(page)).revision === beforePanels)
  const openFirst = row(page, first).locator('.record-summary')
  await openFirst.focus(); await page.keyboard.press('Enter')
  check('Keyboard opens the original memory in one modal sheet', await openFirst.getAttribute('aria-expanded') === 'true' && await page.locator('dialog:modal').count() === 1 && await row(page, latest).locator('.record-summary').getAttribute('aria-expanded') === 'false')
  check('Record activity uses the persisted scene and has no invented hash story', await row(page, first).locator('.record-story').getAttribute('data-scene-id') === base.records.find(record => record.sessionId === first).scene.sceneId && await page.locator('[data-story-id]').count() === 0)
  await page.keyboard.press('Escape')
  check('Closing the keyboard-opened focus memory restores its row', await openFirst.evaluate(el => el === document.activeElement))
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    check(`Records has no horizontal overflow at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.setViewportSize({ width: 320, height: 900 })
  const larger = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  check('Records remains accessible at320px and200% text', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && await page.locator('.records-modes button').count() === 4)
  await press(page, '只看想法')
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    check(`Thought search fits at ${width}px and 200% text without losing its button`, await page.evaluate(() => {
      const field = document.querySelector('#thought-search').getBoundingClientRect()
      const submit = document.querySelector('.records-search button').getBoundingClientRect()
      return document.documentElement.scrollWidth <= innerWidth && field.width > 0 && field.right <= submit.left && submit.right <= innerWidth
    }))
  }
  await press(page, '全部记录')
  await larger.evaluate(node => node.remove())
  await page.setViewportSize({ width: 375, height: 900 })
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0) })
  await page.screenshot({ path: path.join(output, 'records-375.png'), fullPage: true })
  const revisionBefore = (await snapshot(page)).revision
  await page.locator('.room-preview').click()
  const activityId = base.records.find(record => record.sessionId === first).scene.sceneId
  const spot = page.locator(`[data-room-spot="${activityId}"]`)
  check('The panorama only shows tags for saved focus assignments with no month filter', await page.locator('[data-room-spot]').count() === new Set(base.records.map(record => record.scene.sceneId)).size &&
    await spot.isVisible() && await page.locator('.records-filter-row').count() === 0 && await page.locator('.records-activity').count() === 0)
  await spot.focus(); await page.keyboard.press('Enter')
  const sourceButton = page.locator(`.records-activity[data-entry-id="record:${first}"] > button`)
  await sourceButton.click()
  check('A tag opens the correct saved record and activity illustration', await page.locator('[data-return-activity]').isVisible() && await page.locator(`.records-activity [data-record-id="${first}"] .record-story`).getAttribute('data-scene-id') === activityId)
  await press(page, '全部记录'); await press(page, '生活场景')
  check('Changing mode retains original-record depth and its activity source', await page.locator('[data-return-activity]').isVisible())
  await page.locator('[data-return-activity]').click()
  check('Returning from original record restores source action focus', await sourceButton.evaluate(el => el === document.activeElement))
  await press(page, '返回小屋')
  check('Returning to the room restores the invoked picture tag and hides its source list', await spot.evaluate(el => el === document.activeElement) && await page.locator('.records-activity').count() === 0)
  await press(page, '我的收藏'); await press(page, '欢迎笺'); await press(page, '关闭欢迎笺')
  check('Welcome is read-only and close returns focus; browsing never creates writes', await page.getByRole('button', { name: '欢迎笺', exact: true }).evaluate(el => el === document.activeElement) && (await snapshot(page)).revision === revisionBefore)
  await context.close()

  // Use the timer itself for both kinds of rest ending. A source in the album must survive
  // a later activity, a failed commit and reopening the app with the deadline already past.
  const { context: restContext, page: restPage } = await seedPage(browser, base)
  const startRest = async () => {
    const prepare = restPage.getByRole('button', { name: '准备专注', exact: true })
    if (await prepare.isVisible()) await prepare.click()
    await press(restPage, '选择休息')
    await press(restPage, '开始休息')
    await restPage.waitForFunction(k => !!JSON.parse(localStorage.getItem(k)).timer.session, key)
    return (await snapshot(restPage)).timer.session
  }
  await fixTime(restPage, t0 + 60_000)
  const manualRest = await startRest()
  await fixTime(restPage, t0 + 83_000)
  await failWrites(restPage)
  await press(restPage, '结束休息')
  await openRecords(restPage)
  check('An unconfirmed rest has no saved memory or room picture',
    await restPage.locator('[data-rest-id]').count() === 0 && (await snapshot(restPage)).restMemories.length === 0)
  await press(restPage, '生活场景')
  check('A failed rest write leaves its picture off the shelf', await restPage.locator(`[data-room-spot="${manualRest.scene.sceneId}"]`).count() === 0)
  await press(restPage, '全部记录')
  await restPage.evaluate(() => window.restoreRecordWrites())
  await retrySave(restPage)
  const manualRow = restPage.locator(`li[data-rest-id="${manualRest.id}"]`)
  await manualRow.waitFor()
  const savedManual = (await snapshot(restPage)).restMemories
  check('Retry saves the same 23-second manual rest with its assigned activity exactly once',
    savedManual.length === 1 && savedManual[0].sessionId === manualRest.id && savedManual[0].endReason === 'manual' &&
    savedManual[0].elapsedMs === 23_000 && savedManual[0].sceneId === manualRest.scene.sceneId)
  await manualRow.locator('.record-summary').click()
  const restReader = restPage.getByRole('dialog', { name: '休息手记', exact: true })
  check('The rest memory sheet identifies the actual elapsed time', (await restReader.innerText()).includes('23 秒'))
  await restPage.screenshot({ path: path.join(output, 'rest-memory-sheet-375.png'), animations: 'disabled' })
  await restReader.getByRole('button', { name: '返回记录', exact: true }).click()
  check('Closing the rest memory returns focus to its exact source row', await manualRow.locator('.record-summary').evaluate(el => document.activeElement === el))
  await restPage.locator(`.memory-postcard[data-featured-id="rest:${manualRest.id}"]`).waitFor()
  await restPage.evaluate(async () => { await document.fonts.ready; document.activeElement?.blur(); window.scrollTo(0, 0) })
  await restPage.mouse.move(374, 1)
  await restPage.screenshot({ path: path.join(output, 'records-focus-rest-375.png'), animations: 'disabled' })
  await press(restPage, '专注')
  await fixTime(restPage, Date.parse('2026-11-03T23:59:00+08:00'))
  const fullRest = await startRest()
  await fixTime(restPage, fullRest.deadline + 60_000)
  await restPage.reload()
  await openRecords(restPage)
  await restPage.locator(`li[data-rest-id="${fullRest.id}"]`).waitFor()
  const afterRests = await snapshot(restPage)
  const expiredMemory = afterRests.restMemories.find(memory => memory.sessionId === fullRest.id)
  check('Both rests survive reopening; expiry retains its exact deadline, duration and captured day',
    afterRests.restMemories.length === 2 && expiredMemory?.endReason === 'deadline' && expiredMemory.endedAt === fullRest.deadline &&
    expiredMemory.elapsedMs === fullRest.durationMs && expiredMemory.dateKey === '2026-11-04' && await manualRow.count() === 1)
  check('Rest-only dates have no focus subtotal and neither rest changes focus totals or cadence',
    await restPage.locator('.record-day[data-date="2026-11-04"] h3 small').count() === 0 &&
    (await restPage.locator('.records-summary').innerText()).includes('40 秒') &&
    afterRests.records.length === base.records.length && afterRests.timer.completedFocusCount === base.timer.completedFocusCount)
  const featuredRest = restPage.locator(`.memory-postcard[data-featured-id="rest:${fullRest.id}"]`)
  await featuredRest.click()
  check('The latest rest postcard opens the saved activity from that exact rest', await restReader.locator('[data-scene-id]').getAttribute('data-scene-id') === fullRest.scene.sceneId)
  await restPage.waitForFunction(() => history.state?.clockFocusTask === true)
  await restPage.evaluate(() => history.back())
  await restReader.waitFor({ state: 'hidden' })
  check('System Back returns keyboard focus to the featured postcard', await featuredRest.evaluate(el => document.activeElement === el))
  const revisionAfterRests = afterRests.revision
  await press(restPage, '生活场景')
  const restSpot = restPage.locator(`[data-room-spot="${manualRest.scene.sceneId}"]`)
  await restSpot.click()
  const restSource = restPage.locator(`.records-activity[data-entry-id="rest:${manualRest.id}"]`)
  await restSource.locator('[data-view-original]').click()
  check('A rest picture opens the matching original rest, with no focus record substitution',
    await restSource.locator(`li[data-rest-id="${manualRest.id}"]`).isVisible() && await restSource.locator('[data-record-id]').count() === 0)
  await restSource.locator('[data-return-activity]').click()
  await press(restPage, '返回小屋')
  check('Returning from a rest original restores the same picture without writing', await restSpot.evaluate(el => document.activeElement === el) &&
    (await snapshot(restPage)).revision === revisionAfterRests)
  await restContext.close()

  const catalogSample = makeSample(base, 10)
  catalogSample.settings.sceneVarietyEnabled = false
  catalogSample.records.forEach((record, i) => {
    if (i < 9) record.scene = { sceneId: i === 8 ? 'F6' : `F${i + 1}`, ordinal: i + 1, selectionVersion: 2 }
  })
  catalogSample.restMemories = ['R1', 'R2', 'R3'].map((sceneId, i) => ({
    sessionId: `sample-rest-${i}`, sceneId, endedAt: t0 - i, elapsedMs: 23_000, dateKey: '2026-11-02', phase: 'shortBreak', endReason: 'manual',
  }))
  const { context: catalogContext, page: catalog } = await seedPage(browser, catalogSample)
  await openRecords(catalog)
  check('Hidden Focus art keeps a text-only cottage preview available', await catalog.locator('.room-preview').isVisible() && await catalog.locator('.room-thumbnail').count() === 0)
  await catalog.locator('.room-preview').click()
  check('The explicit panorama shows all eleven focus and rest activity sketches and equivalent text entries without changing the art preference',
    await catalog.locator('[data-room-spot]').count() === 11 && await catalog.locator('[data-room-label]').count() === 11 && (await snapshot(catalog)).settings.sceneVarietyEnabled === false)
  for (const width of widths) {
    await catalog.setViewportSize({ width, height: 812 })
    check(`${width}px room fits eleven labeled, non-overlapping picture targets of at least44px`, await catalog.locator('[data-room-spot]').evaluateAll(nodes => {
      const boxes = nodes.map(el => el.getBoundingClientRect())
      return boxes.every((r,i) => r.height >= 44 && r.width >= 44 && boxes.every((b,j) => i === j || r.bottom <= b.top || b.bottom <= r.top || r.right <= b.left || b.right <= r.left)) &&
        document.documentElement.scrollWidth <= innerWidth
    }))
    if (width === 375) {
      await catalog.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0) })
      await catalog.screenshot({ path: path.join(output, 'picture-tags-375.png') })
    }
  }
  await catalog.setViewportSize({ width: 320, height: 568 })
  await catalog.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  await catalog.locator('[data-room-label="F6"]').click()
  check('Large text on a short phone finds both paper-boat records through the text entry', await catalog.locator('.records-activity').count() === 2 && await catalog.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  const paperRow = catalog.locator('.records-activity').first()
  await paperRow.locator('[data-view-original]').click()
  await catalog.waitForFunction(() => history.state?.clockFocusTask === true)
  await catalog.evaluate(() => history.back())
  await catalog.locator('[data-return-activity]').waitFor({ state: 'hidden' })
  await catalog.waitForFunction(() => history.state?.clockFocusTask === true)
  await catalog.evaluate(() => history.back())
  await catalog.locator('.room-source-heading').waitFor({ state: 'hidden' })
  check('Two Back actions return through the paper-boat sources to the exact text entry',
    await catalog.locator('[data-room-label="F6"]').evaluate(el => el === document.activeElement))
  await catalogContext.close()

  for (const count of [1000, 10000]) {
    const sample = makeSample(base, count)
    const { context: scaleContext, page: scale } = await seedPage(browser, sample)
    const started = performance.now()
    await openRecords(scale)
    check(`${count} records initially render at most20 logical rows`, await scale.locator('.records-list [data-entry-id]').count() === 20)
    const firstPageIds = await scale.locator('.records-list [data-entry-id]').evaluateAll(nodes => nodes.map(node => node.dataset.entryId))
    await press(scale, '下一页')
    const secondIds = await scale.locator('.records-list [data-entry-id]').evaluateAll(nodes => nodes.map(node => node.dataset.entryId))
    check(`${count} records page2 replaces page1 and focuses its first object`, secondIds.length === 20 && secondIds.every(id => !firstPageIds.includes(id)) && await scale.locator('.records-list [data-entry-id] button').first().evaluate(el => el === document.activeElement))
    await press(scale, '查看统计'); await press(scale, '近30天')
    check(`${count} statistics window does not change history page`, (await scale.locator('.records-pagination').innerText()).includes('第2页') && (await scale.locator('.records-list [data-entry-id]').first().getAttribute('data-entry-id')) === secondIds[0])
    await press(scale, '选择月份')
    const monthDialog = scale.getByRole('dialog', { name: '选择月份' })
    await monthDialog.getByRole('spinbutton', { name: '年份' }).fill('2026')
    await monthDialog.getByRole('button', { name: '10月', exact: true }).click()
    check(`${count} direct year/month starts matching page1 without changing summary window`, (await scale.locator('.records-pagination').innerText()).includes('第1页') &&
      (await scale.locator('.record-day').evaluateAll(nodes => nodes.every(node => node.dataset.date.startsWith('2026-10-')))) && await scale.getByRole('button', { name: '近30天', exact: true }).getAttribute('aria-pressed') === 'true')
    await press(scale, '下一页')
    await scale.locator('.records-list .record-summary').first().click()
    const monthAnchor = await scale.locator('.records-list [data-entry-id]').first().getAttribute('data-entry-id')
    const memoryReader = scale.getByRole('dialog', { name: '专注手记' })
    const readInSheet = await memoryReader.isVisible()
    if (readInSheet) await memoryReader.getByRole('button', { name: '返回记录' }).click()
    await press(scale, '生活场景')
    await scale.locator('[data-room-label="F3"]').click()
    check(`${count} records group repeated readings into one picture tag with all cross-month sources`, await scale.locator('[data-room-spot]').count() === 1 &&
      Number(await scale.locator('.records-list').getAttribute('data-result-count')) === count / 5 && await scale.locator('.records-activity').count() === 20)
    await press(scale, '下一页')
    const pickedSource = scale.locator('.records-activity').first()
    const pickedId = await pickedSource.getAttribute('data-entry-id')
    await pickedSource.locator('[data-view-original]').click()
    check(`${count} records page two leads to the correct source and back to the same page`, (await pickedSource.locator('[data-record-id]').getAttribute('data-record-id')) === pickedId.slice(7))
    await scale.locator('[data-return-activity]').click()
    check(`${count} records preserve focus and page in the selected tag`, (await scale.locator('.records-pagination').innerText()).includes('第2页') &&
      await pickedSource.locator('[data-view-original]').evaluate(el => el === document.activeElement))
    const boundaryId = await scale.locator('.records-activity').last().getAttribute('data-entry-id')
    if (count === 1000) await scale.locator('.records-activity').last().locator('[data-view-original]').click()
    await press(scale, '全部记录')
    if (count === 1000) {
      const anchor = scale.locator(`[data-entry-id="${monthAnchor}"]`).first()
      const top = (await anchor.boundingBox()).y
      const beforeCount = Number(await scale.locator('.records-list').getAttribute('data-result-count'))
      const peer = await scaleContext.newPage()
      await peer.goto(url)
      await peer.evaluate(k => {
        const data = JSON.parse(localStorage.getItem(k))
        const endedAt = Date.parse('2026-10-31T23:59:00+08:00')
        const incoming = { ...data.records[0], sessionId: 'incoming-peer', dateKey: '2026-10-31', endedAt, startedAt: endedAt - 60_000 }
        data.records.push(incoming)
        data.participations.push({ sessionId: incoming.sessionId, participatedAt: incoming.startedAt, dateKey: incoming.dateKey, source: 'native' })
        data.revision += 1; data.writer = 'records-qa-peer'
        localStorage.setItem(k, JSON.stringify(data))
      }, key)
      await scale.waitForFunction(expected => Number(document.querySelector('.records-list').dataset.resultCount) === expected, beforeCount + 1)
      check('A committed second-tab insertion preserves the current month object and pixel anchor', Math.abs((await anchor.boundingBox()).y - top) <= 2)
      await peer.close()
      await press(scale, '生活场景')
      const movedSource = scale.locator(`.records-activity[data-entry-id="${boundaryId}"]`)
      check('Returning to the cottage follows an open source across a page boundary after a peer insert',
        (await scale.locator('.records-pagination').innerText()).includes('第3页') && await movedSource.locator('[data-return-activity]').isVisible())
      await movedSource.locator('[data-return-activity]').click()
    }
    await press(scale, '只看想法')
    check(`${count} thought mode has its own all-date scope, no timer summary, and a draft entry`, (await scale.locator('.records-filter-row').innerText()).includes('全部日期') && await scale.locator('.records-summary').count() === 0 && await scale.getByRole('button', { name: '继续草稿', exact: true }).isVisible())
    const search = scale.getByRole('searchbox', { name: '搜索想法' })
    await search.fill('A+B.')
    await search.dispatchEvent('compositionstart')
    await search.press('Enter')
    check(`${count} IME selection does not submit search or replace current results`, await scale.locator('.records-list [data-thought-id]').count() === 20 && !(await scale.locator('.records-filter-row').innerText()).includes('A+B.'))
    await search.dispatchEvent('compositionend')
    await press(scale, '搜索')
    const matched = scale.locator('[data-thought-id="thought-180"]')
    await matched.waitFor()
    check(`${count} full-history literal search finds archived note beyond the loaded pages`, await scale.locator('.records-list [data-thought-id]').count() === 1 && (await matched.innerText()).includes('已收起'))
    await matched.locator('.record-summary').click()
    await matched.getByRole('button', { name: '编辑文字', exact: true }).click()
    const editor = scale.getByRole('dialog', { name: '编辑想法' })
    // The existing independent draft must be protected before opening another item.
    const discard = editor.getByRole('button', { name: /放弃.*|丢弃.*/ }).first()
    if (await discard.isVisible()) await discard.click()
    const editorText = editor.getByRole('textbox')
    await editorText.waitFor()
    {
      await editorText.fill('保存后不再匹配之前的关键词')
      await editor.getByRole('button', { name: '保存想法', exact: true }).click()
      await editor.waitFor({ state: 'hidden' })
      check(`${count} a saved edit leaving search stays readable until explicitly closed`, await scale.locator('.records-detached').isVisible() && (await scale.locator('.records-detached').innerText()).includes('保存后不再匹配'))
    }
    await press(scale, '全部记录')
    check(`${count} mode return keeps the month, page and original reading position`, (await scale.locator('.records-filter-row').innerText()).includes('2026年10月') && (await scale.locator('.records-pagination').innerText()).includes('第2页') && await scale.locator(`[data-entry-id="${monthAnchor}"]`).isVisible() && await scale.locator(`[data-entry-id="${monthAnchor}"] .record-summary`).getAttribute('aria-expanded') === String(!readInSheet))
    await press(scale, '专注'); await openRecords(scale)
    check(`${count} temporary Focus visit retains query and page`, (await scale.locator('.records-filter-row').innerText()).includes('2026年10月') && (await scale.locator('.records-pagination').innerText()).includes('第2页'))
    await press(scale, '我的收藏')
    await scale.locator('.records-favorites .record-summary').click()
    await failWrites(scale)
    await press(scale, '取消收藏')
    await scale.getByRole('button', { name: '重试保存', exact: true }).first().waitFor()
    check(`${count} failed favorite cancellation keeps the saved text`, await scale.locator('.records-favorites .record-summary').isVisible() && (await snapshot(scale)).quoteFavorites[0].deletedAt === null)
    await scale.evaluate(() => window.restoreRecordWrites())
    await scale.getByRole('button', { name: '重试保存', exact: true }).first().click()
    await scale.waitForFunction(k => JSON.parse(localStorage.getItem(k)).quoteFavorites[0].deletedAt !== null, key)
    check(`${count} successful cancellation removes only that quote and leaves welcome readable`, await scale.locator('.records-favorites .record-summary').count() === 0 && await scale.getByRole('button', { name: '欢迎笺', exact: true }).isVisible())
    const elapsedMs = Math.round(performance.now() - started)
    scaleResults.push({ records: count, steps: 'page→month→thought search→edit→return→favorite failure/retry', elapsedMs, correctObjects: true })
    await scaleContext.close()
  }

  const { context: deletionContext, page: deletion } = await seedPage(browser, makeSample(base, 30))
  await openRecords(deletion); await press(deletion, '只看想法')
  const target = deletion.locator('[data-thought-id="thought-0"]')
  await target.locator('.record-summary').click()
  await failWrites(deletion); await target.getByRole('button', { name: '删除这条想法', exact: true }).click()
  await deletion.getByRole('button', { name: '重试保存', exact: true }).first().waitFor()
  check('Failed thought deletion retains formal text and exposes retry without inventing success', await target.isVisible() && (await target.innerText()).includes('正式想法 0') && (await snapshot(deletion)).thoughts.find(note => note.id === 'thought-0').deletedAt === null)
  await deletion.evaluate(() => window.restoreRecordWrites())
  await deletion.getByRole('button', { name: '重试保存', exact: true }).first().click()
  await target.waitFor({ state: 'detached' })
  check('Confirmed deletion returns keyboard focus to the next thought', await deletion.locator('[data-thought-id="thought-1"] .record-summary').evaluate(element => element === document.activeElement))
  const undo = deletion.getByRole('button', { name: '撤销删除：正式想法 0', exact: true })
  const cdp = await deletionContext.newCDPSession(deletion)
  for (const [width, height, text, bottom] of [[375, 667, 100, 0], [320, 568, 200, 0], [430, 932, 200, 34], [844, 390, 200, 21]]) {
    await deletion.setViewportSize({ width, height })
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { bottom } })
    await deletion.evaluate(size => { document.documentElement.style.fontSize = `${size}%`; window.scrollTo(0, 0) }, text)
    check(`${width}×${height}/${text}%: a long list keeps the selected thought's Undo visible above navigation`, await undo.evaluate(button => {
      const r = button.getBoundingClientRect(), tabs = document.querySelector('.tab-bar').getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.height >= 44 && r.bottom <= tabs.top && button.contains(hit)
    }))
  }
  await undo.click()
  await target.waitFor()
  check('Undo restores the same identity and original text once', (await snapshot(deletion)).thoughts.filter(note => note.id === 'thought-0' && note.deletedAt === null).length === 1)
  await deletion.reload(); await openRecords(deletion)
  check('Cold open resets viewing choices and keeps historical dates', await deletion.getByRole('button', { name: '全部记录', exact: true }).getAttribute('aria-pressed') === 'true' && await deletion.getByRole('button', { name: '查看统计', exact: true }).getAttribute('aria-expanded') === 'false' && (await snapshot(deletion)).records[0].dateKey === '2026-11-02')
  await deletionContext.close()

  const favoriteSample = makeSample(base, 30)
  favoriteSample.quoteFavorites = Array.from({ length: 45 }, (_, index) => ({ id: `quote-${index}`, text: `值得保留的第${index}句话。`, copyVersion: 'qa1', savedAt: t0 - index, rev: 1, deletedAt: null }))
  const { context: favoriteContext, page: favoritePage } = await seedPage(browser, favoriteSample)
  await favoritePage.setViewportSize({ width: 375, height: 450 })
  await openRecords(favoritePage); await press(favoritePage, '我的收藏'); await press(favoritePage, '下一页')
  const boundaryQuote = favoritePage.locator('.records-favorites li').filter({ hasText: '值得保留的第39句话。' })
  await boundaryQuote.locator('.record-summary').click()
  await boundaryQuote.evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 120))
  const favoriteTop = (await boundaryQuote.boundingBox()).y
  const favoritePeer = await favoriteContext.newPage()
  await favoritePeer.goto(url)
  await favoritePeer.evaluate(k => {
    const data = JSON.parse(localStorage.getItem(k))
    data.quoteFavorites.push({ id: 'newer-peer-quote', text: '另一窗口刚收藏的句子。', copyVersion: 'qa1', savedAt: Date.parse('2026-11-02T21:15:01+08:00'), rev: 1, deletedAt: null })
    data.revision += 1; data.writer = 'favorite-qa-peer'
    localStorage.setItem(k, JSON.stringify(data))
  }, key)
  await favoritePage.waitForFunction(() => document.querySelector('.records-list')?.dataset.resultCount === '46')
  await favoritePage.waitForFunction(() => document.querySelector('.records-pagination')?.textContent.includes('第3页'))
  check('A new favorite in another tab retains the open quote across the20-item page boundary',
    await boundaryQuote.locator('.record-summary').getAttribute('aria-expanded') === 'true' && (await favoritePage.locator('.records-pagination').innerText()).includes('第3页'))
  check('Favorite insertion preserves its pixel anchor and restores the recreated reading trigger focus',
    Math.abs((await boundaryQuote.boundingBox()).y - favoriteTop) <= 2 && await boundaryQuote.locator('.record-summary').evaluate(element => element === document.activeElement))
  await favoriteContext.close()

  // Ordinary timer/save/system feedback changes the title-row control, never
  // inserts a strip between the mode selector and the current reading object.
  for (const width of widths) for (const textScale of [100, 200]) {
    const statusSample = makeSample(base, 30)
    statusSample.thoughtDraft = null
    const { context: statusContext, page: statusPage } = await seedPage(browser, statusSample)
    await statusPage.setViewportSize({ width, height: 812 })
    if (textScale === 200) await statusPage.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    await openRecords(statusPage); await press(statusPage, '我的收藏')
    const statusButton = statusPage.locator('.records-status-button')
    await statusButton.click()
    const statusDialog = statusPage.getByRole('dialog', { name: '应用状态', exact: true })
    const dismiss = statusDialog.getByRole('button', { name: '知道了', exact: true })
    if (await dismiss.isVisible()) await dismiss.click()
    await statusDialog.getByRole('button', { name: '返回记录', exact: true }).click()
    const quote = statusPage.locator('.records-favorites .record-summary')
    await quote.click()
    await statusPage.evaluate(() => window.scrollTo(0, 0))
    const measure = () => statusPage.evaluate(() => {
      const rect = selector => { const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect(); return { x, y, width, height } }
      return { modes: rect('.records-modes'), list: rect('.records-list'), status: rect('.records-status-button') }
    })
    const baseline = await measure()
    if (width === 375 && textScale === 100) {
      await statusPage.evaluate(async () => { await document.fonts.ready; document.activeElement?.blur() })
      await statusPage.mouse.move(374, 1)
      await statusPage.screenshot({ path: path.join(output, 'records-status-quiet-375.png') })
      await quote.focus()
    }
    const stable = async () => {
      const next = await measure()
      return ['modes', 'list', 'status'].every(key => ['x', 'y', 'width', ...(key === 'list' ? [] : ['height'])].every(axis => Math.abs(next[key][axis] - baseline[key][axis]) <= 1))
    }
    check(`${width}px/${textScale}% quiet favorites sit immediately below the modes with an accessible status control`,
      baseline.list.y - (baseline.modes.y + baseline.modes.height) <= 20 && baseline.status.width >= 44 && baseline.status.height >= 44 &&
      await statusPage.locator('.records-session-status').count() === 0 && await statusButton.getAttribute('aria-haspopup') === 'dialog' &&
      await statusPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const peer = await statusContext.newPage()
    await peer.clock.setFixedTime(t0)
    await peer.goto(url)
    await start(peer)
    await statusPage.waitForFunction(() => document.querySelector('.records-status-button').textContent.includes('专注计时'))
    check(`${width}px/${textScale}% active timer does not move modes or the current reading`, await stable() && await quote.evaluate(element => element === document.activeElement))
    await press(peer, '暂停专注')
    await statusPage.waitForFunction(() => document.querySelector('.records-status-button').textContent.includes('专注暂停'))
    check(`${width}px/${textScale}% paused status keeps the same control and reading geometry`, await stable())
    await statusButton.click()
    check(`${width}px/${textScale}% status details explain paused activity outside saved totals`, (await statusDialog.innerText()).includes('已暂停（未计入汇总）'))
    await statusDialog.getByRole('button', { name: '返回记录', exact: true }).click()
    check(`${width}px/${textScale}% closing status restores its source focus and layout`, await statusButton.evaluate(element => element === document.activeElement) && await stable())
    await press(peer, '继续专注')
    await statusPage.waitForFunction(() => document.querySelector('.records-status-button').textContent.includes('专注计时'))
    await failWrites(statusPage)
    await press(statusPage, '取消收藏')
    await statusPage.waitForFunction(() => document.querySelector('.records-status-button').textContent.includes('有待保存'))
    check(`${width}px/${textScale}% save failure stays visible alongside the timer without pushing content`,
      (await statusButton.innerText()).includes('专注计时') && await stable() && await quote.isVisible())
    await statusButton.click()
    check(`${width}px/${textScale}% save failure has complete status details and retry`,
      (await statusDialog.innerText()).includes('尚未保存') && await statusDialog.getByRole('button', { name: '重试保存', exact: true }).isVisible())
    await statusDialog.getByRole('button', { name: '返回记录', exact: true }).click()
    await statusPage.evaluate(async () => { await document.fonts.ready; document.activeElement?.blur(); window.scrollTo(0, 0) })
    await statusPage.mouse.move(width - 1, 1)
    await statusPage.screenshot({ path: path.join(output, `records-status-active-error-${width}-${textScale}.png`) })
    await statusPage.evaluate(() => window.restoreRecordWrites())
    await statusPage.getByRole('button', { name: '重试保存', exact: true }).first().click()
    await statusPage.waitForFunction(k => JSON.parse(localStorage.getItem(k)).quoteFavorites[0].deletedAt !== null, key)
    // The explicit cancellation removed its object and its retry control was
    // below the fold at large text. Return to this test's comparison viewport
    // before checking the subsequent, unsolicited timer expiry.
    await statusPage.evaluate(() => window.scrollTo(0, 0))
    await fixTime(peer, t0 + 1_500_001)
    await statusPage.waitForFunction(() => !document.querySelector('.records-status-button').textContent.includes('专注计时'))
    check(`${width}px/${textScale}% retry and natural expiry keep title and modes fixed`, await stable())
    if (width === 375 && textScale === 100) {
      await statusPage.evaluate(async () => { await document.fonts.ready; document.activeElement?.blur(); window.scrollTo(0, 0) })
      await statusPage.mouse.move(374, 1)
      await statusPage.screenshot({ path: path.join(output, 'records-status-compact-375.png') })
    }
    await statusContext.close()
  }

  assert.deepEqual(errors, [], 'Unexpected browser errors')
  const report = { browser: browser.version(), platform: process.platform, widths, checks, errors, scaleResults, screenshot: 'records-375.png', physicalDevice: false }
  await writeFile(path.join(output, 'browser-review.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`${checks.length} Records v35 checks passed in Chromium ${report.browser}. Evidence: ${output}`)
} finally { await browser?.close(); await app.close() }
