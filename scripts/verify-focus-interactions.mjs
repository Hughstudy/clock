import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { build, preview } from 'vite'

const output = path.resolve(process.env.FOCUS_REVIEW_OUTPUT || '.preview/v5-interactions')
const outDir = path.join(output, 'build')
const key = 'whale-focus:snapshot'
const checks = []
const errors = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name) }
const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' })
const tap = (page, name) => button(page, name).click()
const snapshot = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)
const dialog = page => page.getByRole('dialog')
const geometry = page => page.evaluate(() => ({
  height: document.scrollingElement.scrollHeight,
  bounds: ['.controls .btn-primary', '.tab-bar'].flatMap(selector => {
    const rect = document.querySelector(selector).getBoundingClientRect()
    return [rect.x, rect.y, rect.width, rect.height]
  }),
}))
function stable(before, after) {
  return before.height === after.height && before.bounds.every((value, i) => Math.abs(value - after.bounds[i]) <= 1)
}
async function failWrites(page, fail) {
  await page.evaluate(({ key, fail }) => {
    if (!fail) { Storage.prototype.setItem = window.originalSetItem; return }
    window.originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Injected quota failure', 'QuotaExceededError')
      return window.originalSetItem.call(this, name, value)
    }
  }, { key, fail })
}
async function end(page) {
  await tap(page, '结束这段')
  await tap(dialog(page), '结束并记录')
}
process.env.BASE_PATH = '/clock/'
await mkdir(output, { recursive: true })
// Include the design comparison only in this isolated test build.
await build({ build: { outDir, rolldownOptions: { input: [path.resolve('index.html'), path.resolve('preview/focus/index.html')] } } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
let browser
try {
  browser = await chromium.launch({ channel: process.env.SCENE_BROWSER_CHANNEL })
  const context = await browser.newContext({ viewport: { width: 375, height: 850 }, timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' })
  context.on('page', page => {
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
  await page.clock.install({ time: new Date('2026-10-31T23:58:00+08:00') })
  await page.goto(url)
  await page.getByText('已准备好离线使用。', { exact: true }).waitFor()
  await tap(page, '知道了')
  await button(page, '开始专注 · 25 分钟').waitFor()
  await page.screenshot({ path: path.join(output, 'console-375.png') })
  const comparison = await browser.newPage({ viewport: { width: 375, height: 850 }, reducedMotion: 'reduce' })
  await comparison.goto(url + 'preview/focus/index.html?layout=cards')
  await comparison.getByText('已准备好离线使用。', { exact: true }).waitFor()
  await tap(comparison, '知道了')
  await button(comparison, '开始专注 · 25 分钟').waitFor()
  await comparison.screenshot({ path: path.join(output, 'action-cards-375.png') })
  await tap(comparison, '开始休息 · 5 分钟')
  await button(comparison, '暂停休息').waitFor()
  check('Comparison layout starts the displayed five-minute rest independently', (await snapshot(comparison)).timer.session.durationMs === 300000)
  await comparison.close()
  await tap(page, '选时长')
  await tap(dialog(page), '15 分钟')
  await button(page, '开始专注 · 15 分钟').waitFor()
  check('Choosing a duration changes only the ready display', !(await snapshot(page))?.timer.session)
  await tap(page, '选时长')
  await page.keyboard.press('Escape')
  check('Escape returns focus and retains the displayed choice', await button(page, '选时长').evaluate(el => el === document.activeElement))
  await tap(page, '开始 5 分钟专注')
  await button(page, '暂停').waitFor()
  const first = await snapshot(page)
  const owner = first.timer.session.id
  check('Explicit five-minute start preserves the configured duration and quiet default',
    first.timer.session.durationMs === 300000 && first.settings.durationsMinutes.focus === 25 && !first.settings.soundEnabled)
  await tap(page, '摸摸蓝色伙伴')
  check('A pat leaves the support reader closed', !await dialog(page).count())
  const baseline = await geometry(page)
  await tap(page, '留个记号')
  await button(page, '补充文字').waitFor()
  const markerA = (await snapshot(page)).thoughts[0].id
  check('Marker and undo do not move controls or increase background height', stable(baseline, await geometry(page)))
  await page.clock.fastForward(850)
  await tap(page, '留个记号')
  await tap(page, '看本段想法')
  await button(dialog(page), '补充文字').first().click()
  await page.locator('#thought-text').fill('只补第一个记号')
  await tap(dialog(page), '保存想法')
  await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).thoughts.find(t => t.id === id)?.text === '只补第一个记号', { key, id: markerA })
  const marked = (await snapshot(page)).thoughts
  check('Supplement updates the selected marker only', marked.length === 2 && marked.find(t => t.id !== markerA).text === '')
  if (await dialog(page).count()) await page.keyboard.press('Escape')
  await tap(page, '写想法')
  await page.locator('#thought-text').fill('晚上取快递')
  await page.clock.fastForward(800)
  await page.clock.fastForward(300000)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).records.length === 1, key)
  check('Expiry leaves the editor and text in place', await page.locator('#thought-text').inputValue() === '晚上取快递' &&
    await page.locator('#thought-text').evaluate(el => el === document.activeElement))
  const second = await context.newPage()
  await second.clock.install({ time: new Date(await page.evaluate(() => Date.now())) })
  await second.goto(url)
  await tap(second, '专注模式')
  await tap(second, /^开始专注 ·/)
  await page.waitForFunction(({ key, owner }) => {
    const active = JSON.parse(localStorage.getItem(key)).timer.session
    return active && active.id !== owner
  }, { key, owner })
  await tap(dialog(page), '保存想法')
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).thoughts.some(t => t.text === '晚上取快递'), key)
  const drafted = (await snapshot(page)).thoughts.filter(t => t.text === '晚上取快递')
  check('Draft saved after midnight and a second-tab start stays with the original session and creation day',
    drafted.length === 1 && drafted[0].sessionId === owner && drafted[0].dateKey === '2026-10-31')
  if (await dialog(page).count()) await page.keyboard.press('Escape')
  await tap(page, '给我一句鼓励')
  const reading = dialog(page).locator('.requested-phrase')
  const phrase = await reading.innerText()
  await tap(second, '暂停')
  await page.locator('.clock-badge').getByText('已暂停').waitFor()
  check('A remote pause keeps the requested phrase readable', Boolean(phrase) && await reading.innerText() === phrase)
  await page.keyboard.press('Escape')
  await second.close()
  await page.bringToFront()
  const failingSession = (await snapshot(page)).timer.session.id
  await failWrites(page, true)
  const beforeFail = await geometry(page)
  await end(page)
  await button(page, '重试保存').waitFor()
  check('Failed save leaves its retry reachable and controls stable', stable(beforeFail, await geometry(page)))
  await tap(page, /^开始休息/)
  await button(page, '暂停休息').waitFor()
  await failWrites(page, false)
  await tap(page, '重试保存')
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).timer.phase === 'shortBreak', key)
  const healed = await snapshot(page)
  check('Retry during rest persists the original focus end once', healed.records.filter(r => r.sessionId === failingSession).length === 1 && healed.timer.session?.status === 'running')
  await tap(page, '结束休息')
  await tap(page, /^开始专注 ·/)
  await button(page, '暂停').waitFor()
  const held = (await snapshot(page)).timer.session
  const pauseBox = await button(page, '暂停').boundingBox()
  await page.mouse.move(pauseBox.x + pauseBox.width / 2, pauseBox.y + pauseBox.height / 2)
  await page.mouse.down()
  await page.clock.fastForward(held.durationMs + 100)
  await button(page, /^开始休息/).waitFor()
  await page.mouse.up()
  const released = await snapshot(page)
  check('Releasing a held Pause after expiry cannot start the suggested rest',
    !released.timer.session && released.records.filter(r => r.sessionId === held.id).length === 1)
  await tap(page, /^再开一段/)
  await button(page, '暂停').waitFor()
  const confirming = (await snapshot(page)).timer.session
  await tap(page, '结束这段')
  await page.clock.fastForward(confirming.durationMs + 100)
  await dialog(page).waitFor({ state: 'detached' })
  const expired = await snapshot(page)
  check('An obsolete end confirmation closes after expiry and settles once at the deadline',
    expired.records.filter(r => r.sessionId === confirming.id && r.endReason === 'deadline').length === 1)
  await tap(page, '写想法')
  const editor = page.locator('#thought-text')
  await editor.fill('😀'.repeat(501))
  check('Overlong text remains editable with submission disabled', await editor.inputValue() === '😀'.repeat(501) && await button(dialog(page), '保存想法').isDisabled())
  await editor.fill('😀'.repeat(500))
  check('A 500-code-point supplementary-character draft can be saved', await button(dialog(page), '保存想法').isEnabled())
  await editor.fill('   ')
  await page.keyboard.press('Escape')
  const countBeforeConflict = (await snapshot(page)).thoughts.length
  const peer = await context.newPage()
  await peer.clock.install({ time: new Date(await page.evaluate(() => Date.now())) })
  await peer.goto(url)
  const editMarker = async p => {
    await tap(p, '记录')
    await tap(p, '只看想法')
    const row = p.locator(`[data-thought-id="${markerA}"]`)
    await row.locator('.record-summary').click()
    await tap(row, '编辑文字')
  }
  await editMarker(page)
  await editMarker(peer)
  await peer.locator('#thought-text').fill('另一窗口的新版本')
  await tap(dialog(peer), '保存想法')
  await peer.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).thoughts.find(t => t.id === id)?.text === '另一窗口的新版本', { key, id: markerA })
  await editor.fill('本页保留的另一种写法')
  await button(dialog(page), '另存为新想法').waitFor()
  check('Stale editing preserves both texts and requires an explicit decision',
    await editor.inputValue() === '本页保留的另一种写法' && await button(dialog(page), '保存想法').isDisabled())
  await tap(dialog(page), '另存为新想法')
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).thoughts.some(t => t.text === '本页保留的另一种写法'), key)
  const afterConflict = (await snapshot(page)).thoughts
  check('Save as new preserves the peer revision and creates exactly one additional note',
    afterConflict.length === countBeforeConflict + 1 && afterConflict.find(t => t.id === markerA).text === '另一窗口的新版本')
  await dialog(page).waitFor({ state: 'detached' })
  await tap(page, '专注')
  await tap(page, '写想法')
  await editor.fill('回执 A')
  await page.evaluate(() => {
    const locks = navigator.locks
    const request = locks.request.bind(locks)
    locks.request = async (...args) => {
      locks.request = request
      await new Promise(resolve => { window.releaseWrite = resolve })
      return request(...args)
    }
  })
  await tap(dialog(page), '保存想法')
  await page.waitForFunction(() => typeof window.releaseWrite === 'function')
  await editor.fill('回执 B')
  await page.evaluate(() => window.releaseWrite())
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).thoughtDraft?.text === '回执 B', key)
  check('Delayed confirmation for A leaves the newer text B in the editor', await editor.inputValue() === '回执 B')
  await failWrites(page, true)
  await tap(dialog(page), '保存想法')
  await button(dialog(page), '重试保存').waitFor()
  await editor.fill('后续草稿 C')
  await failWrites(page, false)
  await tap(dialog(page), '重试保存')
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).thoughtDraft?.text === '后续草稿 C', key)
  const retried = await snapshot(page)
  check('Retry saves A and B once each and keeps draft C', ['回执 A', '回执 B'].every(text => retried.thoughts.filter(t => t.text === text).length === 1) &&
    await editor.inputValue() === '后续草稿 C')
  check('No runtime or console errors', errors.length === 0)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors }, null, 2))
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
