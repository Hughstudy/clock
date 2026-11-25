import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { build, preview } from 'vite'
import { launchChromium, showFocusTools } from './lib/browser.mjs'

const output = path.resolve(process.env.INTERACTION_REVIEW_OUTPUT || '.preview/interaction-review')
const outDir = path.join(output, 'build'), key = 'whale-focus:snapshot'
const checks = [], errors = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name) }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const tap = (page, name) => button(page, name).click()
const snapshot = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)
const focused = locator => locator.evaluate(el => document.activeElement === el)
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const editor = page => page.locator('#thought-text')
async function imeEscape(page, target) {
  for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
    await target.evaluate((el, extra) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...extra })), init)
    await frames(page)
  }
}
async function holdWrites(page) {
  await page.evaluate(() => {
    const request = navigator.locks.request.bind(navigator.locks)
    window.releaseWrites = []; window.holdWrites = true
    navigator.locks.request = async (...args) => {
      if (window.holdWrites) await new Promise(resolve => window.releaseWrites.push(resolve))
      return request(...args)
    }
  })
}
async function releaseWrites(page, all = false) {
  await page.waitForFunction(() => window.releaseWrites.length > 0)
  await page.evaluate(all => { if (all) window.holdWrites = false; window.releaseWrites.shift()() }, all)
}
async function checkPrompt(page, label) {
  const prompt = page.locator('.thought-switch')
  await prompt.waitFor()
  check(label + ': confirmation takes keyboard focus', await prompt.evaluate(el => el.contains(document.activeElement)))
  check(label + ': the focused choice is fully visible inside its reading surface', await prompt.evaluate(el => {
    const surface = el.closest('.jl-body, .focus-panel__body')
    const frame = surface.getBoundingClientRect(), target = document.activeElement.getBoundingClientRect()
    return target.top >= frame.top - 1 && target.bottom <= frame.bottom + 1
  }))
  check(label + ': choices have separated rows, usable targets and no horizontal overflow', await prompt.evaluate(el => {
    const bounds = el.getBoundingClientRect(), buttons = [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect())
    return buttons.every((b, i) => b.height >= 44 && b.width <= bounds.width + 1 && b.left >= bounds.left - 1 &&
      b.right <= bounds.right + 1 && (i === 0 || b.top >= buttons[i - 1].bottom + 4)) && document.documentElement.scrollWidth <= innerWidth
  }))
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  check(label + ': keyboard reaches and reveals the last choice', await prompt.evaluate(el => {
    const last = el.querySelector('button:last-child'), surface = el.closest('.jl-body, .focus-panel__body')
    const frame = surface.getBoundingClientRect(), target = last.getBoundingClientRect()
    return document.activeElement === last && target.top >= frame.top - 1 && target.bottom <= frame.bottom + 1
  }))
  await prompt.locator('button:not(:disabled)').first().focus()
}

await mkdir(output, { recursive: true })
process.env.BASE_PATH = '/clock/'
await build({ build: { outDir } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const browser = await launchChromium()
const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
async function open(width = 375, scale = 1) {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : width === 430 ? 932 : 812 }, timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(7000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.clock.install({ time: new Date('2026-11-21T12:00:00+08:00') })
  await page.goto(url)
  await button(page, '开始专注').waitFor()
  if (scale === 2) await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  return { context, page }
}
try {
  const { context, page } = await open()
  await tap(page, '设置')
  await page.getByRole('switch', { name: '伙伴动画', exact: true }).click()
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k))?.settings.motionEnabled === false, key)
  await holdWrites(page)
  for (let i = 0; i < 3; i++) await tap(page, '增加专注分钟数')
  check('Three queued increments immediately show 28', await page.locator('#duration-focus').inputValue() === '28')
  await releaseWrites(page)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).settings.durationsMinutes.focus === 26, key)
  await page.waitForFunction(() => window.releaseWrites.length === 1)
  await frames(page)
  check('The first save does not roll back the two later choices', await page.locator('#duration-focus').inputValue() === '28')
  await tap(page, '增加专注分钟数')
  await releaseWrites(page, true)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).settings.durationsMinutes.focus === 29, key)
  check('A fourth increment while saves settle persists 29', await page.locator('#duration-focus').inputValue() === '29')
  // A reset and a later choice must also retain their submission order.
  await page.evaluate(() => { window.holdWrites = true })
  await tap(page, '恢复默认时长')
  await tap(page, '增加专注分钟数')
  await page.locator('.settings-row').filter({has:page.locator('#duration-shortBreak')}).getByRole('button',{name:/增加/}).click()
  await releaseWrites(page)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).settings.durationsMinutes.focus === 25, key)
  await page.waitForFunction(() => window.releaseWrites.length === 1)
  await frames(page)
  check('Reset acknowledgement preserves later choices in both fields', await page.locator('#duration-focus').inputValue() === '26' && await page.locator('#duration-shortBreak').inputValue() === '6')
  await releaseWrites(page, true)
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).settings.durationsMinutes.shortBreak === 6, key)
  await imeEscape(page, page.locator('#duration-focus'))
  check('IME Escape does not dismiss Settings', await page.locator('.settings').isVisible())
  await page.keyboard.press('Escape')
  check('Ordinary Escape still returns from Settings', await button(page, '开始专注').isVisible())
  await showFocusTools(page)
  await tap(page, '记下想法')
  await editor(page).fill('   ')
  await tap(page, '另写一条')
  check('An unsavable draft focuses Continue instead of its disabled Save choice',
    await button(page, '保存当前想法后继续').isDisabled() && await focused(button(page, '继续当前草稿')))
  await page.keyboard.press('Enter')
  check('Continuing an unsavable draft preserves its exact text and input focus',
    await focused(editor(page)) && await editor(page).inputValue() === '   ')
  await context.close()

  for (const width of [320, 375, 430]) for (const scale of [1, 2]) {
    const { context, page } = await open(width, scale), label = `${width}px/${scale * 100}%`
    await showFocusTools(page)
    await tap(page, '记下想法')
    const paused = (await snapshot(page)).timer.session
    await editor(page).fill('原来保存的想法')
    await tap(page, '保存想法')
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    const original = (await snapshot(page)).thoughts[0].id
    await showFocusTools(page)
    await tap(page, '记下想法')
    await editor(page).fill('尚未提交的草稿')
    await imeEscape(page, editor(page))
    check(label + ': IME Escape keeps the Focus editor and its text', await editor(page).isVisible() && await editor(page).inputValue() === '尚未提交的草稿')
    await tap(page, '另写一条')
    await checkPrompt(page, label + ' Focus')
    await button(page, '继续当前草稿').focus(); await page.keyboard.press('Enter')
    check(label + ': continuing a draft restores typing focus and the same text', await focused(editor(page)) && await editor(page).inputValue() === '尚未提交的草稿')
    await page.keyboard.press('Escape')
    await tap(page, '记录')
    await page.getByRole('tab', { name: '想法', exact: true }).click()
    await page.locator(`[data-jl-note="${original}"]`).click()
    await tap(page, '编辑文字')
    await checkPrompt(page, label + ' Records')
    if (width === 320 && scale === 2) await page.screenshot({ path: path.join(output, 'draft-switch-320-200.png') })
    await tap(page, '放弃草稿并切换')
    await editor(page).waitFor()
    check(label + ': discard-and-switch opens the selected note with typing focus', await focused(editor(page)) && await editor(page).inputValue() === '原来保存的想法')
    await imeEscape(page, editor(page))
    check(label + ': IME Escape keeps the Records editor in its chapter', await editor(page).isVisible())
    await tap(page, '另写一条')
    await tap(page, '保存当前想法后继续')
    await editor(page).waitFor()
    await page.waitForFunction(() => document.querySelector('#thought-text')?.value === '')
    check(label + ': save-and-switch opens one blank draft and retains the saved note once', await focused(editor(page)) && (await snapshot(page)).thoughts.filter(t => t.id === original && t.text === '原来保存的想法').length === 1)
    await page.keyboard.press('Escape')
    check(label + ': ordinary Escape returns to the source note', await page.locator(`[data-jl-detail="note"][data-thought-id="${original}"]`).isVisible())
    await page.keyboard.press('Escape')
    const search = page.getByRole('searchbox', { name: '搜索想法' })
    check(label + ': legacy IME Enter does not submit a search', await search.evaluate(el => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true })
      el.dispatchEvent(event); return event.defaultPrevented
    }))
    await search.fill('原来'); await page.locator('[data-jl-search]').click()
    await page.locator(`[data-jl-note="${original}"]`).waitFor()
    check(label + ': ordinary search still finds the saved note', await page.locator('[data-jl-note]').count() === 1)
    assert.deepEqual((await snapshot(page)).timer.session, paused, label + ': writing and navigation preserve the paused timer')
    await context.close()
  }
  check('Interaction regression flows have no runtime or console errors', errors.length === 0)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors, physicalDevice: false, ime: 'Synthetic composing/keyCode events; physical IME acceptance remains separate' }, null, 2))
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
