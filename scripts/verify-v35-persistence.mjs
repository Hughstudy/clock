import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { holdFocusCard, launchChromium } from './lib/browser.mjs'
import { build, preview } from 'vite'

const output = path.resolve(process.env.V35_PERSISTENCE_OUTPUT || '.preview/v35-persistence')
const outDir = path.join(output, 'build'), key = 'whale-focus:snapshot'
const checks = [], errors = []
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS', name) }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const tap = (page, name) => button(page, name).click()
const snapshot = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)
const until = (page, expression) => page.waitForFunction(({ key, expression }) => {
  const value = JSON.parse(localStorage.getItem(key)); return new Function('value', `return ${expression}`)(value)
}, { key, expression })
async function writes(page, fail) {
  await page.evaluate(({ key, fail }) => {
    window.originalSetItem ??= Storage.prototype.setItem
    Storage.prototype.setItem = fail ? function(name, value) {
      if (name === key) throw new DOMException('Injected quota failure', 'QuotaExceededError')
      return window.originalSetItem.call(this, name, value)
    } : window.originalSetItem
  }, { key, fail })
}
async function newPage(context, url) {
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.clock.install({ time: new Date('2026-11-02T12:00:00+08:00') })
  await page.goto(url)
  await button(page, '开始专注').waitFor()
  await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready })
  const details = button(page, '查看状态')
  if (await details.isVisible()) {
    await details.click()
    const notice = button(page, '知道了')
    if (await notice.isVisible()) await notice.click()
    await page.keyboard.press('Escape')
  }
  return page
}
async function addThought(page, text) {
  await tap(page, '记下想法')
  await page.locator('#thought-text').fill(text)
  await tap(page.getByRole('dialog'), '保存想法')
  await until(page, `value?.thoughts.some(t => t.text === ${JSON.stringify(text)})`)
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  return (await snapshot(page)).thoughts.find(t => t.text === text).id
}
async function noteRows(page) { await tap(page, '记录'); await page.getByRole('tab', { name: '想法', exact: true }).click() }
const noteRow = (page, id) => page.locator(`[data-jl-note="${id}"]`)
const noteDetail = page => page.locator('[data-jl-detail="note"]')
const bookEditor = page => page.locator('[data-jl-detail="editor"]')
const quoteRow = page => page.locator('[data-jl-quote-detail]').first()
const favoriteDetail = page => page.locator('[data-jl-detail="quote"]')
async function statistics(page) {
  if (!await page.locator('[data-jl-detail="stats"]').isVisible()) {
    await page.locator('[data-jl-contents]').click()
    await tap(page, '查看统计')
  }
  return page.locator('[data-jl-detail="stats"]').innerText()
}
async function removeThought(page, id) {
  await noteRow(page, id).click()
  await tap(noteDetail(page), '删除这条想法')
}

process.env.BASE_PATH = '/clock/'
await mkdir(output, { recursive: true })
await build({ build: { outDir } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
let browser
try {
  browser = holdFocusCard(await launchChromium())
  const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
  const options = { viewport: { width: 375, height: 850 }, timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' }

  // Formal records never use provisional time or provisional note mutations.
  const context = await browser.newContext(options), page = await newPage(context, url)
  await tap(page, '开始专注')
  await until(page, 'value?.timer.session')
  await page.clock.fastForward(20_000)
  await writes(page, true)
  await tap(page, '结束专注'); await tap(page.getByRole('dialog'), '确认结束')
  await button(page, '准备专注').waitFor()
  await tap(page, '记录')
  check('A failed ended-record write stays visible but contributes zero saved sessions',
    /待保存/.test(await page.locator('#rj-leaf').innerText()) && /0 段已结束专注/.test(await statistics(page)))
  await writes(page, false)
  await tap(page, '专注'); await tap(page, '查看状态'); await tap(page.getByRole('dialog'), '重试保存')
  await until(page, 'value?.records.length === 1')
  await page.keyboard.press('Escape'); await tap(page, '记录')
  check('Retry contributes the one confirmed record exactly once', /1 段已结束专注/.test(await statistics(page)))
  await tap(page, '专注')
  const first = await addThought(page, '保留原文甲'), second = await addThought(page, '保留原文乙')
  await noteRows(page)
  await writes(page, true); await removeThought(page, first)
  await noteDetail(page).getByText(/有更改待保存/).first().waitFor()
  check('Failed deletion retains the saved note text and a local retry action',
    (await noteDetail(page).innerText()).includes('保留原文甲') && await button(noteDetail(page), '重试保存').isVisible())
  await writes(page, false); await tap(noteDetail(page), '重试保存')
  await noteRow(page, first).waitFor({ state: 'detached' })
  await removeThought(page, second); await noteRow(page, second).waitFor({ state: 'detached' })
  await tap(page, '专注'); await tap(page, '留个标记'); await noteRows(page)
  check('Both ten-minute deletion undos survive a later marker operation',
    await button(page, '撤销删除：保留原文甲').isVisible() && await button(page, '撤销删除：保留原文乙').isVisible())
  await tap(page, '撤销删除：保留原文甲')
  await noteRow(page, first).waitFor()
  check('Undo restores the original ID and text without duplicating the item',
    (await snapshot(page)).thoughts.filter(t => t.id === first && t.deletedAt === null).length === 1)
  await tap(page, '专注'); await page.clock.fastForward(1000)
  const markerCount = (await snapshot(page)).thoughts.length
  await tap(page, '留个标记')
  await until(page, `value?.thoughts.length === ${markerCount + 1}`)
  const markStart = await page.evaluate(() => performance.now())
  const oldMarker = (await snapshot(page)).thoughts.at(-1).id
  await tap(page.locator('.fp-note'), '撤销标记')
  await until(page, `value?.thoughts.find(t => t.id === ${JSON.stringify(oldMarker)})?.deletedAt !== null`)
  await tap(page, '留个标记')
  const markEnd = await page.evaluate(() => performance.now())
  await until(page, `value?.thoughts.at(-1)?.id !== ${JSON.stringify(oldMarker)}`)
  check('A new mark after quick undo creates a new ID within the coalescing window',
    markEnd - markStart < 800 && (await snapshot(page)).thoughts.at(-1).deletedAt === null)
  await context.close()

  // Save A, continue typing B, and then save B must update the same formal item.
  const editingContext = await browser.newContext(options), editorPage = await newPage(editingContext, url)
  await tap(editorPage, '记下想法')
  const editor = editorPage.locator('#thought-text')
  await editor.fill('  保存 A \n')
  await editorPage.clock.fastForward(700)
  await until(editorPage, 'value?.thoughtDraft?.text === "  保存 A \\n"')
  await editorPage.evaluate(() => {
    const request = navigator.locks.request.bind(navigator.locks)
    navigator.locks.request = async (...args) => {
      navigator.locks.request = request
      await new Promise(resolve => { window.releaseV35Write = resolve })
      return request(...args)
    }
  })
  await tap(editorPage.getByRole('dialog'), '保存想法')
  await editorPage.waitForFunction(() => typeof window.releaseV35Write === 'function')
  await editor.fill('  继续 B \n')
  await editorPage.evaluate(() => window.releaseV35Write())
  await until(editorPage, 'value?.thoughts.length === 1')
  await editorPage.clock.runFor(800)
  await until(editorPage, 'value?.thoughtDraft?.text === "  继续 B \\n"')
  const original = (await snapshot(editorPage)).thoughts[0]
  check('Delayed Save A retains exact whitespace and rebounds B onto the original item',
    original.text === '  保存 A \n' && (await snapshot(editorPage)).thoughtDraft.thoughtId === original.id && await editor.inputValue() === '  继续 B \n')
  await tap(editorPage.getByRole('dialog'), '保存想法')
  await until(editorPage, 'value?.thoughts[0]?.text === "  继续 B \\n"')
  check('Saving continued text updates one note rather than creating A and B records',
    (await snapshot(editorPage)).thoughts.length === 1 && (await snapshot(editorPage)).thoughts[0].id === original.id)
  await editorPage.getByRole('dialog').waitFor({ state: 'detached' })
  await noteRows(editorPage)
  await noteRow(editorPage, original.id).click()
  await tap(noteDetail(editorPage), '编辑文字')
  await editor.fill('失败期间 C')
  await editorPage.clock.runFor(700)
  await writes(editorPage, true)
  await tap(bookEditor(editorPage), '保存想法')
  await button(bookEditor(editorPage), '重试保存').waitFor()
  await editor.fill('重试期间 D')
  await writes(editorPage, false)
  await tap(bookEditor(editorPage), '重试保存')
  await until(editorPage, 'value?.thoughts[0]?.text === "失败期间 C"')
  await editorPage.clock.runFor(800)
  await until(editorPage, 'value?.thoughtDraft?.text === "重试期间 D"')
  check('Retry confirms C on the same item while preserving later input D as its draft',
    (await snapshot(editorPage)).thoughts.length === 1 && (await snapshot(editorPage)).thoughtDraft.thoughtId === original.id && await editor.inputValue() === '重试期间 D')
  await editingContext.close()

  // An unchanged empty marker still needs its draft retirement saved. Matching
  // the already-durable note alone must not close the editor or report success.
  const unchangedContext = await browser.newContext(options), unchangedPage = await newPage(unchangedContext, url)
  await tap(unchangedPage, '留个标记')
  await until(unchangedPage, 'value?.thoughts.length === 1')
  const unchangedId = (await snapshot(unchangedPage)).thoughts[0].id
  await noteRows(unchangedPage)
  await noteRow(unchangedPage, unchangedId).click()
  await tap(noteDetail(unchangedPage), '补充文字')
  await unchangedPage.locator('#thought-text').fill('临时文字')
  await unchangedPage.locator('#thought-text').fill('')
  await unchangedPage.clock.runFor(700)
  await until(unchangedPage, 'value?.thoughtDraft?.text === ""')
  const draftBeforeFailure = (await snapshot(unchangedPage)).thoughtDraft.id
  await writes(unchangedPage, true)
  await tap(bookEditor(unchangedPage), '保存想法')
  await button(bookEditor(unchangedPage), '重试保存').waitFor()
  check('Failed unchanged marker save keeps its editor and durable draft instead of reporting success',
    await unchangedPage.locator('#thought-text').isVisible() && (await snapshot(unchangedPage)).thoughtDraft.id === draftBeforeFailure && (await snapshot(unchangedPage)).thoughts[0].rev === 1)
  await writes(unchangedPage, false)
  await tap(bookEditor(unchangedPage), '重试保存')
  await noteDetail(unchangedPage).waitFor()
  check('Retry confirms draft retirement without duplicating or revising the unchanged marker',
    !(await snapshot(unchangedPage)).thoughtDraft && (await snapshot(unchangedPage)).thoughts.length === 1 && (await snapshot(unchangedPage)).thoughts[0].rev === 1)
  await unchangedPage.locator('[data-jl-back]').click()
  await tap(unchangedPage, '专注'); await tap(unchangedPage, '设置')
  await writes(unchangedPage, true)
  await unchangedPage.getByRole('switch', { name: '到时提示音', exact: true }).click()
  await unchangedPage.locator('[aria-live="assertive"]').filter({ hasText: '最新更改尚未保存' }).waitFor()
  check('A settings save failure is announced without opening the status details',
    await unchangedPage.locator('[aria-live]').count() === 1 && await unchangedPage.getByRole('dialog').count() === 0)
  await unchangedContext.close()

  // Favorite failure, late acknowledgement, cancellation, and peer synchronization.
  const favoriteContext = await browser.newContext(options), favoritePage = await newPage(favoriteContext, url)
  await tap(favoritePage, '给我一句鼓励')
  const phraseA = await favoritePage.locator('.fp-reader-quote:visible').innerText()
  await writes(favoritePage, true); await tap(favoritePage, '收藏这句')
  await button(favoritePage, '等待保存确认').waitFor()
  check('A failed favorite never reports a saved star', await button(favoritePage, '等待保存确认').getAttribute('aria-pressed') === 'false')
  await tap(favoritePage, '换一句鼓励')
  const phraseB = await favoritePage.locator('.fp-reader-quote:visible').innerText()
  check('Changing quotes remains available while A is pending', phraseA !== phraseB && await button(favoritePage, '收藏这句').isEnabled())
  await writes(favoritePage, false)
  await button(favoritePage, '重试保存').last().click()
  await until(favoritePage, 'value?.quoteFavorites.some(q => q.deletedAt === null)')
  check('A late favorite receipt leaves B unselected and preserves A text',
    await button(favoritePage, '收藏这句').getAttribute('aria-pressed') === 'false' && (await snapshot(favoritePage)).quoteFavorites[0].text === phraseA)
  await tap(favoritePage, '给我一句鼓励'); await tap(favoritePage, '记录'); await favoritePage.getByRole('tab', { name: '收藏', exact: true }).click()
  await quoteRow(favoritePage).click()
  await writes(favoritePage, true); await tap(favoriteDetail(favoritePage), '取消收藏')
  await favoriteDetail(favoritePage).getByText(/尚未确认保存/).first().waitFor()
  check('Failed cancellation retains the original saved favorite in the open reader', (await favoriteDetail(favoritePage).innerText()).includes(phraseA))
  await writes(favoritePage, false); await tap(favoriteDetail(favoritePage), '重试保存')
  await until(favoritePage, 'value?.quoteFavorites[0]?.deletedAt !== null')
  await favoriteDetail(favoritePage).waitFor({ state: 'detached' })
  await favoritePage.locator('[data-jl-section="favorites"] .jl-empty').waitFor()
  await quoteRow(favoritePage).waitFor({ state: 'detached' })
  check('Confirmed cancellation clears its text snapshot and keeps a versioned tombstone', (await snapshot(favoritePage)).quoteFavorites[0].text === '')
  await tap(favoritePage, '专注'); await tap(favoritePage, '给我一句鼓励'); await tap(favoritePage, '收藏这句')
  await button(favoritePage, '取消收藏这句').waitFor()
  await tap(favoritePage, '给我一句鼓励'); await tap(favoritePage, '记录'); await favoritePage.getByRole('tab', { name: '收藏', exact: true }).click()
  const peer = await newPage(favoriteContext, url)
  await tap(peer, '记录'); await peer.getByRole('tab', { name: '收藏', exact: true }).click()
  await quoteRow(peer).click()
  await tap(favoriteDetail(peer), '取消收藏')
  await favoritePage.locator('[data-jl-section="favorites"] .jl-empty').waitFor()
  await favoritePage.reload(); await tap(favoritePage, '记录'); await favoritePage.getByRole('tab', { name: '收藏', exact: true }).click()
  check('Peer cancellation synchronizes and cannot resurrect after reload', await quoteRow(favoritePage).count() === 0)
  await favoriteContext.close()

  const lockContext = await browser.newContext(options), lockPage = await newPage(lockContext, url)
  await tap(lockPage, '给我一句鼓励')
  const blockedPhrase = await lockPage.locator('.fp-reader-quote:visible').innerText()
  await lockPage.evaluate(() => {
    const request = navigator.locks.request.bind(navigator.locks)
    navigator.locks.request = async (...args) => {
      navigator.locks.request = request
      throw new DOMException('Injected lock failure before mutation', 'AbortError')
    }
  })
  await tap(lockPage, '收藏这句')
  await lockPage.locator('.fp-reader-feedback:visible').filter({ hasText: '尚未确认保存' }).waitFor()
  await tap(lockPage, '换一句鼓励'); await tap(lockPage, '收藏这句')
  await button(lockPage, '取消收藏这句').waitFor()
  await tap(lockPage, '给我一句鼓励'); await tap(lockPage, '记录'); await lockPage.getByRole('tab', { name: '收藏', exact: true }).click()
  const failure = await lockPage.locator('#rj-leaf').innerText()
  check('Unapplied lock failure for A remains explained after a successful B favorite',
    failure.includes(Array.from(blockedPhrase).slice(0, 18).join('')) && failure.includes('尚未确认保存') && (await snapshot(lockPage)).quoteFavorites.filter(q => q.deletedAt === null).length === 1)
  await tap(lockPage.locator('#rj-leaf'), '重试保存')
  await until(lockPage, 'value?.quoteFavorites.filter(q => q.deletedAt === null).length === 2')
  check('Retry replays the unaccepted A command once without duplicating B', (await snapshot(lockPage)).quoteFavorites.length === 2)
  await lockContext.close()
  check('Production persistence flows have no runtime or console errors', errors.length === 0)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors, physicalDevice: false }, null, 2))
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
