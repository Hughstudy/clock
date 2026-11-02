import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { build, preview } from 'vite'

const output = path.resolve(process.env.PANEL_REVIEW_OUTPUT || '.preview/v35-panels')
const outDir = path.join(output, 'build')
const checks = []
const errors = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const dialog = page => page.getByRole('dialog')
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
    if (await dialog(page).getAttribute('aria-modal') === 'true') {
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
  browser = await chromium.launch({ channel: process.env.SCENE_BROWSER_CHANNEL })
  for (const [width, height, font] of [[320, 568, 16], [320, 568, 32], [320, 850, 32], [375, 812, 16], [568, 320, 32], [850, 320, 32], [430, 932, 32]]) {
    const name = `${width}x${height}-${font === 32 ? '200' : '100'}percent`
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`))
    await page.goto(url)
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px` }, font)
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
    await button(page, '给我一句鼓励').click()
    await button(dialog(page), '换一种鼓励').scrollIntoViewIfNeeded()
    await button(dialog(page), '换一种鼓励').click()
    const category = button(dialog(page), '有点累了')
    check(`${name}: keyboard reaches a visible category`, await tabTo(page, category) && await inViewAndHit(category))
    await page.keyboard.press('Enter')
    check(`${name}: returning to reading keeps its focused action visible`, await inViewAndHit(button(dialog(page), '换一种鼓励')))
    await page.screenshot({ path: path.join(output, `${name}-reader.png`) })
    const close = button(dialog(page), '收到鼓励了')
    check(`${name}: reader close remains fully reachable`, await tabTo(page, close) && await inViewAndHit(close))
    await page.keyboard.press('Enter')
    await dialog(page).waitFor({ state: 'detached' })
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(`resize: ${error.message}`))
  await page.goto(url)
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
  check('No browser page errors', errors.length === 0)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors, keyboard: 'simulated visualViewport; not a physical keyboard/device test' }, null, 2))
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
