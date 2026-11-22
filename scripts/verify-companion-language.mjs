import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build, preview } from 'vite'
import { launchChromium } from './lib/browser.mjs'

const output = path.resolve('.preview/companion-language')
const outDir = path.join(output, 'build')
const catalog = JSON.parse(await readFile('src/data/encouragement.zh-CN.json', 'utf8'))
const checks = [], errors = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const snapshot = page => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')))
const speech = page => page.locator('.fp-head-speech p')
const belongs = (pool, text) => catalog.entries.some(e => e.pool === pool && e.text === text)
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
async function wake(page) {
  if (await page.locator('.fp-handle').count()) {
    await page.locator('.fp-handle').click()
    await page.clock.fastForward(500)
  }
}
async function endFocus(page) {
  await wake(page)
  await button(page, '结束专注').click()
  await button(page, '确认结束').click()
  await button(page, '开始休息').waitFor()
}

process.env.BASE_PATH = '/clock/'
await mkdir(output, { recursive: true })
await build({ build: { outDir } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const browser = await launchChromium()
const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
try {
  for (const width of [320, 375, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 812 }, reducedMotion: 'reduce', hasTouch: true })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()) })
    await page.clock.install({ time: new Date('2026-11-22T09:00:00Z') })
    await page.goto(url)
    await button(page, '开始专注').waitFor()
    check(`${width}: first use stays quiet`, await speech(page).count() === 0)
    await button(page, '开始专注').click()
    await speech(page).waitFor({ state: 'attached' })
    const started = await speech(page).innerText()
    check(`${width}: start uses its eligible pool`, belongs('STA', started))
    await page.clock.fastForward(1000)
    check(`${width}: countdown does not change the phrase`, await speech(page).innerText() === started)
    await page.clock.fastForward(5000)
    await page.locator('.home[data-chrome="away"]').waitFor()
    check(`${width}: the passing line leaves with the controls`, await speech(page).count() === 0)
    await wake(page)
    check(`${width}: waking controls does not replay speech`, await speech(page).count() === 0)

    await button(page, '给我一句鼓励').click()
    const reader = page.getByRole('region', { name: '一句鼓励' })
    const quote = page.locator('.fp-reader-quote:visible')
    const category = reader.getByRole('combobox', { name: '鼓励类型' })
    for (const pool of width === 375 ? ['ASKG', 'ASKS', 'ASKB', 'ASKT'] : ['ASKG']) {
      await category.selectOption(pool)
      let previous = null
      for (let i = 0; i < 24; i++) {
        const text = await quote.innerText()
        check(`${width}: ${pool} draw ${i + 1} is eligible and differs from the previous phrase`, belongs(pool, text) && text !== previous)
        previous = text
        if (i !== 23) {
          await button(reader, '换一句鼓励').focus()
          await page.keyboard.press('Enter')
        }
      }
    }
    const chosen = await quote.innerText()
    await button(reader, '收藏这句').click()
    await page.waitForFunction(text => JSON.parse(localStorage.getItem('whale-focus:snapshot')).quoteFavorites.some(q => q.text === text && q.deletedAt === null), chosen)
    const session = (await snapshot(page)).timer.session.id
    await button(page, '记下想法').click()
    await page.getByRole('dialog', { name: '记下想法', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await reader.waitFor()
    check(`${width}: an editor preserves the requested phrase and timer`, await quote.innerText() === chosen && (await snapshot(page)).timer.session.id === session)
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
    await frames(page)
    check(`${width}: 200% text retains the whole phrase`, await quote.innerText() === chosen && await quote.isVisible())
    check(`${width}: 200% text does not overflow horizontally`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await button(reader, '换一句鼓励').focus()
    await page.keyboard.press('Enter')
    check(`${width}: keyboard changes the quote and retains focus`, await quote.innerText() !== chosen && await button(reader, '换一句鼓励').evaluate(e => e === document.activeElement))
    await page.screenshot({ path: path.join(output, `reader-${width}-200.png`), fullPage: true })
    await page.reload()
    await button(page, '暂停专注').waitFor()
    check(`${width}: active-session reload does not greet`, await speech(page).count() === 0)
    check(`${width}: favorites retain clicked text and version`, (await snapshot(page)).quoteFavorites.some(q => q.text === chosen && q.copyVersion === catalog.requestedCopyVersion && q.deletedAt === null))
    await page.clock.fastForward(31_000)
    await endFocus(page)
    await speech(page).waitFor({ state: 'attached' })
    check(`${width}: a saved ending can speak from END`, belongs('END', await speech(page).innerText()))
    await button(page, '开始休息').click()
    await button(page, '暂停休息').waitFor()
    check(`${width}: immediate rest does not stack a second automatic phrase`, await speech(page).count() === 0)
    await button(page, '结束休息').click()
    await button(page, '开始专注').waitFor()
    await page.reload()
    await button(page, '开始专注').waitFor()
    await speech(page).waitFor({ state: 'attached' })
    const greeting = await speech(page).innerText()
    check(`${width}: returning to a saved ready page greets`, belongs('RET', greeting))
    await page.clock.fastForward(1000)
    check(`${width}: entry greeting survives initial recovery without rotating`, await speech(page).innerText() === greeting)
    await page.clock.fastForward(30_000)
    await button(page, '选择休息').click()
    await button(page, '开始休息').click()
    await speech(page).waitFor({ state: 'attached' })
    check(`${width}: rest speaks from BRK after the shared cooldown`, belongs('BRK', await speech(page).innerText()))
    await page.screenshot({ path: path.join(output, `rest-${width}.png`), fullPage: true })
    await button(page, '暂停休息').click()
    check(`${width}: pausing rest keeps factual feedback only`, await speech(page).count() === 0)
    await context.close()
  }
  check('No browser console or page errors', errors.length === 0)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors, physicalDevice: false }, null, 2))
  console.log(`${checks.length} checks passed`)
} finally {
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
