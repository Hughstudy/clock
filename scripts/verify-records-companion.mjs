import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
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
  browser = await chromium.launch({ executablePath: process.env.SCENE_BROWSER_EXECUTABLE, channel: process.env.SCENE_BROWSER_CHANNEL })
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, timezoneId: 'Asia/Singapore' })
  const page = await context.newPage()
  observe(page)
  await page.clock.setFixedTime(t0)
  await page.goto(url)
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
  await page.evaluate(() => window.restoreRecordWrites())
  await retrySave(page)
  await page.locator(`li[data-record-id="${latest}"][data-saved="true"]`).waitFor()
  const base = await snapshot(page)
  check('Retry records same identity once; zero seconds stays visible and two 20-second segments total40', base.records.length === 3 && base.records.filter(record => record.sessionId === latest).length === 1 &&
    (await row(page, zero).innerText()).includes('已开始过这一段') && (await page.locator('.records-summary').innerText()).includes('40 秒'))
  check('All four modes are visible, hero is removed and statistics are collapsed initially',
    await page.locator('.records-modes button').count() === 4 && await page.locator('.records-greeting').count() === 0 &&
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
  check('Keyboard expands one record and retains focus on its trigger', await openFirst.getAttribute('aria-expanded') === 'true' && await openFirst.evaluate(el => el === document.activeElement) && await row(page, latest).locator('.record-summary').getAttribute('aria-expanded') === 'false')
  check('Record activity uses the persisted scene and has no invented hash story', await row(page, first).locator('.record-story').getAttribute('data-scene-id') === base.records.find(record => record.sessionId === first).scene.sceneId && await page.locator('[data-story-id]').count() === 0)
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    check(`Records has no horizontal overflow at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.setViewportSize({ width: 320, height: 900 })
  const larger = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  check('Records remains accessible at320px and200% text', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && await page.locator('.records-modes button').count() === 4)
  await larger.evaluate(node => node.remove())
  await page.setViewportSize({ width: 375, height: 900 })
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0) })
  await page.screenshot({ path: path.join(output, 'records-375.png'), fullPage: true })
  const revisionBefore = (await snapshot(page)).revision
  await press(page, '生活场景')
  await page.locator('.records-activity .record-summary').first().click()
  await press(page, '查看原记录')
  check('Activity opens its original record without a new world or fabricated acquired objects', await page.getByRole('button', { name: '返回伙伴活动', exact: true }).isVisible() && await page.locator('.records-activity .record-story').isVisible())
  await press(page, '全部记录'); await press(page, '生活场景')
  check('Changing mode retains original-record depth and its activity source', await page.getByRole('button', { name: '返回伙伴活动', exact: true }).isVisible())
  await press(page, '返回伙伴活动')
  check('Returning from original record restores source action focus', await page.getByRole('button', { name: '查看原记录', exact: true }).evaluate(el => el === document.activeElement))
  await press(page, '我的收藏'); await press(page, '欢迎笺'); await press(page, '关闭欢迎笺')
  check('Welcome is read-only and close returns focus; browsing never creates writes', await page.getByRole('button', { name: '欢迎笺', exact: true }).evaluate(el => el === document.activeElement) && (await snapshot(page)).revision === revisionBefore)
  await context.close()

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
    check(`${count} mode return keeps month, page2 and expanded identity`, (await scale.locator('.records-filter-row').innerText()).includes('2026年10月') && (await scale.locator('.records-pagination').innerText()).includes('第2页') && await scale.locator(`[data-entry-id="${monthAnchor}"]`).isVisible() && await scale.locator(`[data-entry-id="${monthAnchor}"] .record-summary`).getAttribute('aria-expanded') === 'true')
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
  await deletion.getByRole('button', { name: /撤销删除/ }).first().click()
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
