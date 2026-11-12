import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { holdFocusCard, launchChromium } from './lib/browser.mjs'
import { build, preview } from 'vite'

const output = path.resolve(process.env.PANEL_REVIEW_OUTPUT || '.preview/v35-panels')
const outDir = path.join(output, 'build')
const checks = []
const errors = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const dialog = page => page.getByRole('dialog')
const interruptedLine = '我回到桌边，会先摸一摸那块没摆好的积木。也许接着摆，也许换个地方。'
async function speechAtHead(page, speech) {
  const bubble = await speech.boundingBox(), head = await page.locator('.fp-art [data-part="tuft"]').boundingBox()
  const tail = await speech.evaluate(element => {
    const style = getComputedStyle(element, '::after'), left = parseFloat(style.left)
    return { left, right: left + parseFloat(style.width), height: parseFloat(style.height) }
  })
  const gap = head.y - (bubble.y + bubble.height), headX = head.x + head.width / 2
  return gap - tail.height >= -1 && gap - tail.height <= 12 && tail.height > 0 &&
    headX >= bubble.x + tail.left - 3 && headX <= bubble.x + tail.right + 3
}
async function inViewAndHit(target) {
  return target.evaluate(element => {
    const rect = element.getBoundingClientRect(), viewport = window.visualViewport
    const top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? innerHeight)
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
    const hit = document.elementFromPoint(x, y)
    return rect.top >= top - 1 && rect.bottom <= bottom + 1 && rect.left >= -1 && rect.right <= innerWidth + 1 && !!hit && (hit === element || element.contains(hit))
  })
}
async function tabTo(page, target) {
  for (let i = 0; i < 25; i++) {
    if (await target.evaluate(element => document.activeElement === element)) return true
    await page.keyboard.press('Tab')
    if (await dialog(page).count() && await dialog(page).getAttribute('aria-modal') === 'true') {
      assert.ok(await dialog(page).evaluate(element => element.contains(document.activeElement)), 'Modal Tab must stay inside the current panel')
    }
  }
  return false
}

function focusBounds(page) {
  return page.evaluate(() => [...document.querySelectorAll('.fp-digits, .fp-controls button, .fp-thought-tools button, .tab-bar button')].map(element => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return [x, y, width, height]
  }).flat())
}
function sameBounds(before, after) {
  return before.length === after.length && before.every((value, i) => Math.abs(value - after[i]) <= 1)
}

process.env.BASE_PATH = '/clock/'
await mkdir(output, { recursive: true })
await build({ build: { outDir } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
let browser
try {
  browser = holdFocusCard(await launchChromium())
  for (const [width, height, font] of [[320, 568, 16], [320, 812, 16], [320, 568, 32], [320, 850, 32], [375, 812, 16], [375, 667, 18], [375, 812, 32], [568, 320, 32], [850, 320, 32], [430, 932, 16], [430, 932, 32]]) {
    const name = `${width}x${height}-${font / 16 * 100}percent`
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`))
    await page.goto(url)
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px` }, font)
    await page.evaluate(async () => {
      await document.fonts.ready
      for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame)
    })
    const clock = page.getByRole('button', { name: /^调整专注时长/ })
    const clockBefore = await clock.boundingBox()
    const scroll = () => page.evaluate(() => [scrollX, scrollY, document.querySelector('.fp-plate').scrollTop])
    const originalScroll = await scroll()
    const art = page.locator('.fp-art')
    const artBefore = await art.boundingBox()
    check(`${name}: the time and pencil share an accessible 44px target`, clockBefore.width >= 44 && clockBefore.height >= 44)
    await clock.click()
    const duration = page.getByRole('dialog', { name: '调专注时长' })
    const pop = await duration.boundingBox()
    if (artBefore) {
      const artDuring = await art.boundingBox()
      check(`${name}: opening the ruler preserves the visible companion and room`, artDuring &&
        sameBounds(Object.values(artBefore), Object.values(artDuring)))
    }
    check(`${name}: the picker opens in the top layer without moving the Focus screen`, await duration.evaluate(el => el.matches(':modal')) &&
      sameBounds(originalScroll, await scroll()))
    if (height > width && font < 32) {
      check(`${name}: the ruler opens directly below the clock`, pop.y >= clockBefore.y + clockBefore.height - 1 &&
        pop.y - clockBefore.y - clockBefore.height <= 8 && Math.abs(pop.x + pop.width / 2 - clockBefore.x - clockBefore.width / 2) <= 1)
    }
    await page.screenshot({ path: path.join(output, `${name}-duration.png`) })
    check(`${name}: the duration cancel control is visible and hit-testable`, await inViewAndHit(button(duration, '取消')))
    await page.getByRole('textbox', { name: '专注分钟数' }).fill('31')
    const applyDuration = button(duration, '用这个时长')
    check(`${name}: keyboard reaches a hit-testable duration apply control`, await tabTo(page, applyDuration) && await inViewAndHit(applyDuration))
    await page.keyboard.press('Enter')
    await duration.waitFor({ state: 'detached' })
    const after = await clock.boundingBox()
    check(`${name}: applying restores the clock target and scroll position`, Math.abs(clockBefore.y - after.y) < 1 &&
      Math.abs(clockBefore.x + clockBefore.width / 2 - after.x - after.width / 2) < 1 && sameBounds(originalScroll, await scroll()) &&
      await clock.evaluate(el => el === document.activeElement))
    check(`${name}: applying the duration closes the panel without starting`, await page.getByRole('button', { name: '调整专注时长，当前 31 分钟' }).isVisible() &&
      await page.evaluate(() => !JSON.parse(localStorage.getItem('whale-focus:snapshot'))?.timer.session))
    await button(page, '记下想法').click()
    await page.locator('#thought-text').fill(`可保存的测试想法 ${name}`)
    await page.screenshot({ path: path.join(output, `${name}-editor.png`) })
    const frame = await dialog(page).boundingBox()
    check(`${name}: panel stays inside viewport`, frame && frame.y >= -1 && frame.y + frame.height <= height + 1)
    check(`${name}: close is visible and unobscured`, await inViewAndHit(dialog(page).locator('.focus-panel__header button')))
    check(`${name}: no horizontal page or panel overflow`, await page.evaluate(() => {
      const body = document.querySelector('.focus-panel__body')
      return document.documentElement.scrollWidth <= innerWidth + 1 && body.scrollWidth <= body.clientWidth + 1
    }))
    if (await dialog(page).getAttribute('aria-modal') === 'true') {
      await page.evaluate(() => document.querySelector('.fp-primary button').focus())
      check(`${name}: covered background cannot take keyboard focus`, await dialog(page).evaluate(element => element.matches(':modal') && element.contains(document.activeElement)))
    }
    const save = button(dialog(page), '保存想法')
    check(`${name}: keyboard reaches the fully visible save action`, await tabTo(page, save) && await inViewAndHit(save))
    await page.keyboard.press('Enter')
    await dialog(page).waitFor({ state: 'detached' })
    check(`${name}: keyboard save persists the entered text`, await page.evaluate(text => JSON.parse(localStorage.getItem('whale-focus:snapshot')).thoughts.some(thought => thought.text === text), `可保存的测试想法 ${name}`))
    const ask = button(page, '给我一句鼓励')
    check(`${name}: the single encouragement opener is a tool on the plate`, await button(page.locator('.fp-plate .fp-thought-tools'), '给我一句鼓励').count() === 1 && await ask.count() === 1)
    await ask.scrollIntoViewIfNeeded()
    const before = await focusBounds(page)
    await ask.click()
    const reader = page.getByRole('region', { name: '一句鼓励' })
    const speech = page.locator('.fp-companion-speech[data-visible="true"]')
    const quote = reader.locator('.fp-reader-quote')
    const next = button(reader, '换一句鼓励')
    const favorite = button(reader, '收藏这句')
    const category = reader.getByRole('combobox', { name: '鼓励类型' })
    await reader.waitFor()
    check(`${name}: one requested quote and one control set appear without a second dialog`, await reader.count() === 1 && await quote.count() === 1 && !await dialog(page).count() && await ask.getAttribute('aria-pressed') === 'true')
    await category.selectOption('ASKB')
    // Read the reported sentence in its actual catalogue rotation and its actual line breaks.
    for (let other = 0; other < 14 && await quote.innerText() !== interruptedLine; other++) await next.click()
    check(`${name}: the interrupted quote is readable in full without clipping`, await quote.innerText() === interruptedLine && await quote.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1))
    if (font < 32 && height >= 667) {
      await speech.waitFor()
      check(`${name}: opening and changing a request preserves the timer, tool and tab targets`, sameBounds(before, await focusBounds(page)))
      check(`${name}: the speech bubble sits immediately above the drawn head`, await speechAtHead(page, speech))
      const digits = await page.locator('.fp-digits').boundingBox()
      const bubble = await speech.boundingBox()
      check(`${name}: the entire bubble clears the clock`, bubble.y >= digits.y + digits.height - 1)
      const wordBox = await quote.boundingBox()
      for (const control of [next, favorite, category]) {
        const box = await control.boundingBox()
        check(`${name}: ${await control.getAttribute('aria-label') || await control.innerText()} is directly under the spoken text and clear of the face`,
          await inViewAndHit(control) && box.width >= 44 && box.height >= 44 && box.y >= wordBox.y + wordBox.height - 1 && box.y + box.height <= bubble.y + bubble.height + 1)
      }
      check(`${name}: timer and thought actions stay reachable during reading`, await inViewAndHit(button(page, '开始专注')) && await inViewAndHit(button(page, '记下想法')) && await inViewAndHit(button(page, '留个标记')))
    }
    await page.screenshot({ path: path.join(output, `${name}-reader.png`) })
    check(`${name}: keyboard reaches the direct favorite action`, await tabTo(page, favorite) && await inViewAndHit(favorite))
    await page.keyboard.press('Enter')
    await page.waitForFunction(text => JSON.parse(localStorage.getItem('whale-focus:snapshot')).quoteFavorites.some(q => !q.deletedAt && q.text === text), interruptedLine)
    check(`${name}: the actual saved sentence is marked`, await button(reader, '取消收藏这句').getAttribute('aria-pressed') === 'true')
    check(`${name}: the native category selector is keyboard reachable`, await tabTo(page, category) && await inViewAndHit(category))
    await category.selectOption('ASKT')
    check(`${name}: selecting a category updates the sentence in the same reader`, await quote.innerText() !== interruptedLine && await category.inputValue() === 'ASKT' && !await dialog(page).count())
    check(`${name}: the request toggle remains the reachable close action`, await tabTo(page, ask) && await inViewAndHit(ask))
    await page.keyboard.press('Enter')
    await reader.waitFor({ state: 'detached' })
    check(`${name}: closing returns keyboard focus to the encouragement opener`, await ask.evaluate(element => element === document.activeElement))
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(`resize: ${error.message}`))
  await page.goto(url)
  await page.getByRole('button', { name: /^调整专注时长/ }).click()
  const durationInput = page.getByRole('textbox', { name: '专注分钟数' })
  await durationInput.fill('37')
  await durationInput.evaluate(element => { window.originalDurationInput = element; element.setSelectionRange(0, 1) })
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
  await page.locator('.home[data-layout="readable"]').waitFor()
  check('Enlarging text keeps the duration input, value, caret and focus in the anchored picker', await durationInput.evaluate(element =>
    element === window.originalDurationInput && element.value === '37' && element.selectionStart === 0 && element.selectionEnd === 1 && document.activeElement === element))
  await page.evaluate(() => { document.documentElement.style.fontSize = '16px' })
  await page.locator('.home[data-layout="scene"]').waitFor()
  check('Returning to the original text size preserves its input and reachable cancel', await durationInput.evaluate(element => element === window.originalDurationInput && element.value === '37') && await inViewAndHit(button(dialog(page), '取消')))
  await button(dialog(page), '取消').click()
  await button(page, '记下想法').click()
  await page.locator('#thought-text').fill('缩放和键盘变化期间保留的文字')
  await page.locator('#thought-text').evaluate(element => { window.originalEditor = element; element.setSelectionRange(2, 5) })
  check('A roomy screen shows the editor as a modal sheet', await dialog(page).getAttribute('aria-modal') === 'true' && await dialog(page).getAttribute('data-layout') === 'sheet')
  await page.setViewportSize({ width: 320, height: 568 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
  await page.waitForFunction(() => document.querySelector('.focus-panel')?.getAttribute('aria-modal') === 'true')
  check('Resize to modal preserves the same input, caret and focus', await page.locator('#thought-text').evaluate(element => element === window.originalEditor && document.activeElement === element && element.selectionStart === 2 && element.selectionEnd === 5))
  await page.evaluate(() => {
    window.simulatedKeyboardHeight = 280
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => window.simulatedKeyboardHeight })
    window.visualViewport.dispatchEvent(new Event('resize'))
  })
  await page.waitForFunction(() => document.querySelector('.focus-panel')?.getBoundingClientRect().bottom <= 281)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.screenshot({ path: path.join(output, '320-200percent-simulated-keyboard.png') })
  check('Visual-viewport keyboard resize preserves input selection', await page.locator('#thought-text').evaluate(element => element === window.originalEditor && element.value === '缩放和键盘变化期间保留的文字' && element.selectionStart === 2 && element.selectionEnd === 5))
  const save = button(dialog(page), '保存想法')
  check('With keyboard viewport, Tab reaches a fully visible save', await tabTo(page, save) && await inViewAndHit(save))
  check('With keyboard viewport, close remains visible and unobscured', await inViewAndHit(dialog(page).locator('.focus-panel__header button')))
  await page.evaluate(() => { delete window.visualViewport.height; window.visualViewport.dispatchEvent(new Event('resize')) })
  await page.evaluate(() => { document.documentElement.style.fontSize = '16px' })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForFunction(() => document.querySelector('.focus-panel')?.dataset.keyboard === 'false')
  check('Returning to roomy viewport keeps the same editor text', await page.locator('#thought-text').evaluate(element => element === window.originalEditor && element.value === '缩放和键盘变化期间保留的文字'))
  const grip = await page.locator('.focus-panel__header h2').boundingBox()
  const pull = async distance => {
    await page.mouse.move(grip.x + 10, grip.y + 8)
    await page.mouse.down()
    await page.mouse.move(grip.x + 10, grip.y + 8 + distance, { steps: 6 })
    await page.mouse.up()
  }
  await pull(30)
  check('A short pull on the sheet header leaves the sheet open', await dialog(page).count() === 1)
  await pull(240)
  await dialog(page).waitFor({ state: 'detached' })
  check('Pulling the sheet header down closes it and keeps the draft', await button(page, '继续草稿').isVisible())
  await button(page, '给我一句鼓励').click()
  const reader = page.getByRole('region', { name: '一句鼓励' })
  const next = button(reader, '换一句鼓励'), phrase = await reader.locator('.fp-reader-quote').innerText()
  await next.focus()
  await page.setViewportSize({ width: 320, height: 568 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
  await page.locator('.fp-voice-slot .fp-encouragement').waitFor()
  check('The large-text reading area preserves the quote and keyboard action', !await dialog(page).count() &&
    await reader.locator('.fp-reader-quote').innerText() === phrase && await next.evaluate(element => element === document.activeElement))
  await page.setViewportSize({ width: 375, height: 812 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '16px' })
  await page.locator('.fp-companion-speech[data-visible="true"]').waitFor()
  check('Returning to head-anchored reading preserves the quote and keyboard action',
    await page.locator('.fp-reader-quote:visible').innerText() === phrase && await next.evaluate(element => element === document.activeElement))
  // Set up the next draw in this isolated profile's saved bag, then start through the normal UI.
  await page.evaluate(() => {
    const key = 'whale-focus:snapshot', saved = JSON.parse(localStorage.getItem(key))
    saved.scenes.focus.remaining = ['F4']
    localStorage.setItem(key, JSON.stringify(saved))
  })
  await page.reload()
  await button(page, '开始专注').click()
  await page.locator('.blue-companion[data-scene="F4"]').waitFor()
  const automatic = page.locator('.fp-bubble:visible')
  await automatic.waitFor()
  check('The automatic tea-scene line points at its off-center head', await speechAtHead(page, automatic))
  const digitsBefore = await page.locator('.fp-digits').boundingBox()
  await button(page, '给我一句鼓励').click()
  const requested = page.locator('.fp-companion-speech[data-visible="true"]')
  await requested.waitFor()
  const digitsAfter = await page.locator('.fp-digits').boundingBox()
  check('Requesting a phrase in the tea scene keeps the tail on the same head and the clock still',
    await speechAtHead(page, requested) && Math.abs(digitsBefore.y - digitsAfter.y) <= 1 && !await automatic.count())
  await page.screenshot({ path: path.join(output, '375x812-tea-reader.png') })
  await button(page, '给我一句鼓励').click()
  await page.setViewportSize({ width: 320, height: 568 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
  await button(page, '暂停专注').click()
  const fullLine = page.locator('.fp-bubble p')
  const source = page.locator('.fp-voice-slot').getByRole('button', { name: /查看全文/ })
  await source.waitFor()
  const pausedLine = await fullLine.textContent()
  check('A passing line that cannot fit at 200% leaves the reading choice to the user', !await dialog(page).count())
  await source.click()
  check('The plate’s full-text action opens the same complete passing line',
    pausedLine.trim().length > 0 && await dialog(page).locator('.fp-full-message').innerText() === pausedLine)
  await page.keyboard.press('Escape')
  await button(page, '继续专注').waitFor()
  check('No browser page errors', errors.length === 0)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors, keyboard: 'simulated visualViewport; not a physical keyboard/device test' }, null, 2))
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
