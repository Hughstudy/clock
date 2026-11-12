import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { holdFocusCard, launchChromium } from './lib/browser.mjs'
import { build, preview } from 'vite'

const output = path.resolve(process.env.RECORDS_REVIEW_OUTPUT || '.preview/records-v35')
const outDir = path.join(output, 'build')
const key = 'whale-focus:snapshot'
const checks = [], errors = [], scaleResults = []
const widths = [320, 375, 430]
const t0 = Date.parse('2026-11-02T21:15:00+08:00')
const snapshot = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)
const check = (description, value) => { assert.ok(value, description); checks.push(description) }
const observe = page => {
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
}
const fixTime = async (page, now) => { await page.clock.setFixedTime(now); await page.evaluate(() => window.dispatchEvent(new Event('focus'))) }
async function start(page) {
  const prepare = page.getByRole('button', { name: '准备专注', exact: true })
  if (await prepare.isVisible()) await prepare.click()
  await press(page, '开始专注')
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k))?.timer.session, key)
  return (await snapshot(page)).timer.session.id
}
async function end(page) {
  await press(page, '结束专注')
  await press(page, '确认结束')
  await page.getByRole('button', { name: '准备专注', exact: true }).waitFor()
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
const app = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const url = `http://127.0.0.1:${app.httpServer.address().port}/clock/`
const leaf = page => page.locator('#ribbon-journal .rj-canvas > [data-leaves]')
const tab = (page, section) => page.locator('#ribbon-journal [role="tab"][data-section="' + section + '"]')
const press = (page, label) => page.getByRole('button', { name: label, exact: true }).click()
const read = (page, kind) => leaf(page).locator('[data-jl-detail="' + kind + '"]')
const back = page => leaf(page).locator('[data-jl-back]').click()
const openRecords = async page => {
  await press(page, '记录')
  await leaf(page).waitFor()
}
const contents = page => leaf(page).locator('[data-jl-contents]').click()
const stats = async page => {
  await contents(page)
  await press(leaf(page), '查看统计')
  return read(page, 'stats').innerText()
}
async function retrySave(page) {
  await page.evaluate(() => window.restoreRecordWrites())
  await page.locator('.records-status-button').click()
  await press(read(page, 'status'), '重试保存')
  await back(page)
}
const anchored = async locator => locator.evaluate(el => {
  const r = el.getBoundingClientRect()
  return [r.top, el.closest('.jl-body').scrollTop, window.scrollY]
})
async function returned(locator, original) {
  await locator.waitFor()
  assert(await locator.evaluate(el => document.activeElement === el))
  assert((await anchored(locator)).every((n, i) => Math.abs(n - original[i]) <= 1))
}
async function noOverflow(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth &&
    document.querySelector('.rj-canvas > [data-leaves] .jl-body').scrollWidth <= document.querySelector('.rj-canvas > [data-leaves] .jl-body').clientWidth + 1))
}
let browser
try {
  browser = holdFocusCard(await launchChromium())
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  observe(page)
  await page.clock.setFixedTime(t0)
  await page.goto(url)
  await openRecords(page)
  assert.equal(await page.getByText('记录索引', { exact: true }).count(), 0)
  assert.equal(await tab(page, 'story').getAttribute('aria-selected'), 'true')
  await tab(page, 'thoughts').click()
  assert.equal(await leaf(page).locator('[data-jl-note]').count(), 0)
  await tab(page, 'room').click()
  assert.equal(await leaf(page).locator('[data-jl-source]').count(), 0)
  await tab(page, 'favorites').click()
  assert.equal(await leaf(page).locator('[data-jl-quote-detail]').count(), 0)
  await leaf(page).locator('[data-jl-letter]').click()
  check('A new book has four bookmarks, a welcome letter and no fictional saved activity', await read(page, 'letter').isVisible())
  assert.equal(await page.locator('dialog:modal').count(), 0)
  await back(page)
  await press(page, '专注')
  const zero = await start(page)
  await end(page)
  const first = await start(page)
  await fixTime(page, t0 + 20_000)
  await end(page)
  const last = await start(page)
  await fixTime(page, t0 + 40_000)
  await failWrites(page)
  await end(page)
  await openRecords(page)
  await tab(page, 'story').click()
  check('Pending focus is excluded from confirmed totals', /20 秒/.test(await stats(page)) && (await snapshot(page)).records.length === 2)
  await back(page)
  await back(page)
  await retrySave(page)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).records.length === 3, key)
  const base = await snapshot(page)
  check('Two 20-second focuses total 40 seconds, alongside the distinct zero-duration focus', /40 秒/.test(await stats(page)) &&
    base.records.find(r => r.sessionId === zero).elapsedMs === 0 && base.records.find(r => r.sessionId === first).elapsedMs === 20_000 &&
    base.records.filter(r => r.sessionId === last).length === 1)
  await back(page)
  await back(page)
  await press(page, '专注')
  await press(page, '准备专注')
  await press(page, '选择休息')
  await press(page, '开始休息')
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).timer.session, key)
  const manual = (await snapshot(page)).timer.session
  await fixTime(page, t0 + 63_000)
  await failWrites(page)
  await press(page, '结束休息')
  await openRecords(page)
  await tab(page, 'room').click()
  const restStamp = leaf(page).locator('[data-jl-source="' + manual.scene.sceneId + '"]')
  check('A failed rest write supplies no confirmed cottage stamp', await restStamp.count() === 0 && !(await snapshot(page)).restMemories.length)
  await retrySave(page)
  await restStamp.click()
  const memory = leaf(page).locator('[data-jl-source-detail]')
  check('Retry exposes the exact 23-second rest on its own cottage page', await memory.getAttribute('data-jl-source-detail') === 'rest:' + manual.id &&
    (await memory.innerText()).includes('23 秒') && (await snapshot(page)).restMemories.length === 1)
  await back(page)
  await press(page, '专注')
  await fixTime(page, Date.parse('2026-11-03T23:59:00+08:00'))
  await press(page, '选择休息')
  await press(page, '开始休息')
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).timer.session, key)
  const elapsed = (await snapshot(page)).timer.session
  await fixTime(page, elapsed.deadline + 60_000)
  await page.reload()
  await openRecords(page)
  const expired = (await snapshot(page)).restMemories.find(r => r.sessionId === elapsed.id)
  check('Rest expiry survives reload with the actual deadline and captured day without changing focus cadence',
    expired?.endedAt === elapsed.deadline && expired.elapsedMs === elapsed.durationMs && expired.dateKey === '2026-11-04' &&
    (await snapshot(page)).timer.completedFocusCount === base.timer.completedFocusCount)
  await context.close()

  const catalog = makeSample(base, 10)
  catalog.settings.sceneVarietyEnabled = false
  catalog.records.forEach((record, i) => {
    if (i < 9) record.scene = { sceneId: i === 8 ? 'F6' : 'F' + (i + 1), ordinal: i + 1, selectionVersion: 2 }
  })
  catalog.restMemories = ['R1','R2','R3'].map((sceneId, i) => ({
    sessionId: 'sample-rest-' + i, sceneId, endedAt: t0 - i, elapsedMs: 23_000,
    dateKey: '2026-11-02', phase: 'shortBreak', endReason: 'manual',
  }))
  const { context: shelfContext, page: shelf } = await seedPage(browser, catalog)
  await openRecords(shelf)
  await tab(shelf, 'room').click()
  const stamps = leaf(shelf).locator('[data-jl-source]')
  assert.equal(await stamps.count(), 11)
  for (const width of widths) {
    await shelf.setViewportSize({ width, height: 812 })
    await noOverflow(shelf)
    assert(await stamps.evaluateAll(els => els.every(el => {
      const r = el.getBoundingClientRect()
      return r.width >= 44 && r.height >= 44
    })))
  }
  await shelf.setViewportSize({ width: 320, height: 568 })
  await shelf.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  const boat = stamps.and(shelf.locator('[data-jl-source="F6"]'))
  await boat.scrollIntoViewIfNeeded()
  const initialPosition = await anchored(boat)
  await boat.click()
  const sources = leaf(shelf).locator('[data-jl-source-page]')
  assert.equal(await sources.count(), 2)
  const original = sources.last()
  const chosen = await original.getAttribute('data-jl-source-page')
  await original.click()
  assert.equal(await leaf(shelf).locator('[data-jl-source-detail]').getAttribute('data-jl-source-detail'), chosen)
  const systemBack = async p => {
    await p.waitForFunction(() => history.state?.clockFocusTask === true)
    await p.evaluate(() => history.back())
  }
  await systemBack(shelf)
  await original.waitFor()
  await systemBack(shelf)
  await returned(boat, initialPosition)
  check('All eleven activities remain readable at large text. Nested Back returns to the same cottage stamp', await tab(shelf, 'room').getAttribute('aria-selected') === 'true')
  await noOverflow(shelf)
  await shelfContext.close()

  // A peer can insert an item between opening a bookmark's detail and turning back.
  const { context: shared, page: reader } = await seedPage(browser, makeSample(base, 40))
  await openRecords(reader)
  await tab(reader, 'thoughts').click()
  const boundary = leaf(reader).locator('[data-jl-note="thought-19"]')
  await boundary.scrollIntoViewIfNeeded()
  const originalY = (await boundary.boundingBox()).y
  await boundary.click()
  const peer = await shared.newPage()
  await peer.goto(url)
  await peer.evaluate(({key,t0}) => {
    const data = JSON.parse(localStorage.getItem(key))
    data.revision++
    data.writer = 'records-peer'
    data.thoughts.push({...data.thoughts[0], id:'new-note', createdAt:t0+1000, text:'新的便笺'})
    localStorage.setItem(key, JSON.stringify(data))
  }, {key,t0})
  await read(reader, 'note').getByText('正式想法 19', {exact:true}).waitFor()
  await back(reader)
  await boundary.waitFor()
  check('A peer insertion preserves a thought across the 20-item boundary, including its focus and visible position',
    (await leaf(reader).locator('.records-pagination').innerText()).includes('第2页') &&
    await boundary.evaluate(el=>document.activeElement===el) && Math.abs((await boundary.boundingBox()).y-originalY)<=1)
  await tab(reader, 'favorites').click()
  const favorite = leaf(reader).locator('[data-jl-quote-detail="qa-quote"]')
  await favorite.click()
  await peer.evaluate(({key,t0}) => {
    const data = JSON.parse(localStorage.getItem(key))
    data.revision++
    data.writer = 'records-peer'
    data.quoteFavorites.push({...data.quoteFavorites[0], id:'peer-quote', text:'另一句', savedAt:t0+1000})
    localStorage.setItem(key, JSON.stringify(data))
  }, {key,t0})
  await back(reader)
  await favorite.waitFor()
  check('The saved quote keeps its identity when a newer favorite arrives', await favorite.evaluate(el=>document.activeElement===el))
  await shared.close()

  for (const count of [1000, 10000]) {
    const { context: large, page: book } = await seedPage(browser, makeSample(base, count))
    const started = performance.now()
    await openRecords(book)
    await contents(book)
    const rows = leaf(book).locator('[data-jl-page]')
    assert.equal(await rows.count(), 20)
    await press(leaf(book), '选择月份')
    await read(book, 'month').getByLabel('年份').fill('2026')
    await press(read(book, 'month'), '10月')
    await rows.first().waitFor()
    assert.equal(await rows.count(), 20)
    const entryId = await rows.first().getAttribute('data-jl-page')
    const list = await snapshot(book)
    assert(list.records.some(r => 'record:' + r.sessionId === entryId && r.dateKey.startsWith('2026-10')))
    await rows.first().click()
    await tab(book, 'room').click()
    await leaf(book).locator('[data-jl-source="F3"]').click()
    assert.equal(await leaf(book).locator('[data-jl-source-page]').count(), 20)
    await tab(book, 'thoughts').click()
    const search = leaf(book).getByRole('searchbox')
    await search.fill('Café A+B.')
    await leaf(book).locator('[data-jl-search]').click()
    const match = leaf(book).locator('[data-jl-note="thought-180"]')
    await match.click()
    check(count + ' records: month and room lists page correctly; thought search finds an old saved item', (await read(book, 'note').innerText()).includes('找回旧念头'))
    await back(book)
    await press(book, '专注')
    await openRecords(book)
    assert.equal(await search.inputValue(), 'Café A+B.')
    await tab(book, 'favorites').click()
    const quote = leaf(book).locator('[data-jl-quote-detail]').first()
    await quote.click()
    await failWrites(book)
    await press(read(book, 'quote'), '取消收藏')
    await leaf(book).getByRole('button', { name: '重试保存', exact: true }).first().waitFor()
    assert.equal((await snapshot(book)).quoteFavorites[0].deletedAt, null)
    await book.evaluate(() => window.restoreRecordWrites())
    await leaf(book).getByRole('button', { name: '重试保存', exact: true }).first().click()
    await book.waitForFunction(k => JSON.parse(localStorage.getItem(k)).quoteFavorites[0].deletedAt !== null, key)
    check(count + ' records: a failed favorite removal can be retried and reading preserves saved data', (await snapshot(book)).records.length === count)
    scaleResults.push({ records: count, elapsedMs: Math.round(performance.now() - started) })
    await large.close()
  }
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, scaleResults, errors, physicalDevice: false }, null, 2))
  console.log('Records browser checks passed', checks.length, scaleResults)
} finally {
  await browser?.close()
  await app.close()
}
