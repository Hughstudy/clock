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

process.env.BASE_PATH = '/clock/'
await mkdir(output, { recursive: true })
await build({ build: { outDir } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
let browser
try {
  browser = holdFocusCard(await launchChromium())
  for (const [width, height, font] of [[320, 568, 16], [320, 812, 16], [320, 568, 32], [320, 850, 32], [375, 812, 16], [375, 812, 32], [568, 320, 32], [850, 320, 32], [430, 932, 16], [430, 932, 32]]) {
    const name = `${width}x${height}-${font === 32 ? '200' : '100'}percent`
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`))
    await page.goto(url)
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px` }, font)
    await page.getByRole('button', { name: /^调整专注时长/ }).click()
    const duration = page.getByRole('dialog', { name: '调专注时长' })
    if (font === 32) {
      await page.waitForFunction(() => document.querySelector('.fp-duration-surface')?.matches(':modal'))
      check(`${name}: the duration panel escapes the large-text console scrollport`, await duration.getAttribute('data-layout') === 'viewport')
    }
    await page.screenshot({ path: path.join(output, `${name}-duration.png`) })
    check(`${name}: the duration cancel control is visible and hit-testable`, await inViewAndHit(button(duration, '取消')))
    await page.getByRole('textbox', { name: '专注分钟数' }).fill('31')
    const applyDuration = button(duration, '用这个时长')
    check(`${name}: keyboard reaches a hit-testable duration apply control`, await tabTo(page, applyDuration) && await inViewAndHit(applyDuration))
    await page.keyboard.press('Enter')
    await duration.waitFor({ state: 'detached' })
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
    const bounds = () => page.evaluate(() => ['.fp-scene', '.fp-art .blue-companion', '.fp-primary button', '.fp-digits', '.fp-thought-tools', '.tab-bar'].map(selector => {
      const r = document.querySelector(selector).getBoundingClientRect()
      return [r.left, r.top, r.width, r.height]
    }).flat())
    const ask = button(page, '给我一句鼓励')
    const voice = page.locator('.fp-plate .fp-voice-slot')
    check(`${name}: the single encouragement opener is on the plate`, await button(voice, '给我一句鼓励').count() === 1 && await ask.count() === 1)
    await ask.scrollIntoViewIfNeeded()
    const before = await bounds()
    await ask.click()
    const reader = page.getByRole('region', { name: '一句鼓励' })
    const speech = page.locator('.fp-companion-speech[data-visible="true"]')
    if (font === 16 && height >= 800) await speech.waitFor()
    if (await speech.isVisible()) {
      const after = await bounds()
      const moved = after.map((v, i) => +(v - before[i]).toFixed(2))
      check(`${name}: encouragement preserves the drawing area, digits, timer action and navigation`, moved.every(delta => Math.abs(delta) <= 1))
      check(`${name}: the speech bubble sits immediately above the drawn head`, await speechAtHead(page, speech))
      check(`${name}: timer and thought actions stay reachable during reading`,
        await inViewAndHit(button(page, '开始专注')) && await inViewAndHit(button(page, '记下想法')) && await inViewAndHit(button(page, '留个标记')))
      const phraseTools = ['换一句', '收藏这句', '换一种鼓励', '收到鼓励了']
      const visibleTools = await Promise.all(phraseTools.map(label => inViewAndHit(button(voice, label))))
      check(`${name}: all phrase actions share the opener’s plate region and can be tapped`, visibleTools.every(Boolean))
    } else {
      check(`${name}: a crowded scene offers one complete reader`,
        await dialog(page).count() === 1 && await reader.locator('.fp-reader-quote').evaluate(el =>
          el.textContent.trim().length > 0 && el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1))
    }
    await button(reader, '换一种鼓励').scrollIntoViewIfNeeded()
    await button(reader, '换一种鼓励').click()
    const category = button(reader, '有点累了')
    check(`${name}: keyboard reaches a visible category`, await tabTo(page, category) && await inViewAndHit(category))
    await page.keyboard.press('Enter')
    check(`${name}: returning to reading keeps its focused action visible`, await inViewAndHit(button(reader, '换一种鼓励')))
    await page.screenshot({ path: path.join(output, `${name}-reader.png`) })
    const close = button(await dialog(page).count() ? dialog(page) : page, '收到鼓励了')
    check(`${name}: reader close remains fully reachable`, await tabTo(page, close) && await inViewAndHit(close))
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
  await page.waitForFunction(() => document.querySelector('.fp-duration-surface')?.matches(':modal'))
  check('Enlarging text keeps the duration input, value, caret and focus through modal promotion', await durationInput.evaluate(element =>
    element === window.originalDurationInput && element.value === '37' && element.selectionStart === 0 && element.selectionEnd === 1 && document.activeElement === element))
  await page.evaluate(() => { document.documentElement.style.fontSize = '16px' })
  await page.waitForFunction(() => document.querySelector('.fp-duration-surface')?.dataset.layout === 'local')
  check('Returning to the local duration panel preserves its input and reachable cancel', await durationInput.evaluate(element => element === window.originalDurationInput && element.value === '37') && await inViewAndHit(button(dialog(page), '取消')))
  await button(dialog(page), '取消').click()
  await button(page, '记下想法').click()
  await page.locator('#thought-text').fill('缩放和键盘变化期间保留的文字')
  await page.locator('#thought-text').evaluate(element => { window.originalEditor = element; element.setSelectionRange(2, 5) })
  check('A roomy panel keeps normal nonmodal operation', await dialog(page).getAttribute('aria-modal') === 'false')
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
  await page.waitForFunction(() => document.querySelector('.focus-panel')?.getAttribute('aria-modal') === 'false')
  check('Returning to roomy viewport keeps the same editor text', await page.locator('#thought-text').evaluate(element => element === window.originalEditor && element.value === '缩放和键盘变化期间保留的文字'))
  await page.keyboard.press('Escape')
  await button(page, '给我一句鼓励').click()
  const reader = page.getByRole('region', { name: '一句鼓励' })
  const next = button(reader, '换一句'), phrase = await page.locator('.fp-reader-quote:visible').innerText()
  await next.focus()
  await page.setViewportSize({ width: 320, height: 568 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
  await page.getByRole('dialog', { name: '一句鼓励' }).waitFor()
  check('Changing to a crowded reading layout preserves the quote and keyboard action',
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
  await button(page, '收到鼓励了').click()
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
