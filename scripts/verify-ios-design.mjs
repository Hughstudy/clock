import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { webkit } from 'playwright'
import { launchChromium } from './lib/browser.mjs'
import { build, preview } from 'vite'

const output = path.resolve(process.env.IOS_REVIEW_OUTPUT || '.preview/ios-design')
const outDir = path.join(output, 'build')
const checks = [], errors = []
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); console.log('PASS', name) }
const button = (p, name) => p.getByRole('button', { name, exact: true })
const stable = (a, b) => ['x', 'y', 'width', 'height'].every(k => Math.abs(a[k] - b[k]) <= 1)
const snapshot = p => p.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')))
const watch = (p, label) => { p.on('pageerror', e => errors.push(`${label}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`) }) }
process.env.BASE_PATH = '/clock/'
await mkdir(output, { recursive: true })
await build({ build: { outDir } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
const browser = process.env.IOS_BROWSER === 'webkit' ? await webkit.launch() : await launchChromium()
try {
  for (const [width, height] of [[320, 568], [375, 812], [430, 932], [844, 390]]) for (const font of [16, 32]) {
    const name = `${width}x${height}-${font === 32 ? '200' : '100'}`
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference', timezoneId: 'Asia/Singapore' })
    const p = await ctx.newPage(); watch(p, name); p.setDefaultTimeout(8000)
    await p.clock.install({ time: new Date('2026-11-07T04:00:00+08:00') })
    await p.goto(url); await button(p, '开始专注').waitFor()
    await p.evaluate(font => { document.documentElement.style.fontSize = `${font}px` }, font)
    await p.clock.runFor(300)
    await p.screenshot({ path: path.join(output, `${name}-ready.png`) })
    check(`${name}: no horizontal overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await p.getByRole('button', { name: /^调整专注时长/ }).click()
    const picker = p.getByRole('dialog')
    const cancel = picker.locator('.focus-panel__header button')
    check(`${name}: duration Cancel is visible and hit-testable`, await cancel.evaluate(e => {
      const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return r.top >= 0 && r.bottom <= innerHeight && e.contains(hit)
    }))
    await cancel.click(); await picker.waitFor({ state: 'hidden' })
    const primary = button(p, '开始专注')
    await primary.scrollIntoViewIfNeeded()
    const up = await primary.boundingBox()
    await p.mouse.move(up.x + up.width / 2, up.y + up.height / 2); await p.mouse.down(); await p.clock.runFor(180)
    const down = await primary.boundingBox()
    check(`${name}: pressed primary retains its complete 44px target`, stable(up, down) && down.width >= 44 && down.height >= 44)
    await p.mouse.up(); await button(p, '暂停专注').waitFor()
    const mark = button(p, '留个标记'); await mark.scrollIntoViewIfNeeded()
    const before = await mark.boundingBox(), writeBefore = await button(p, '记下想法').boundingBox()
    const point = { x: before.x + before.width - 4, y: before.y + before.height / 2 }
    await p.mouse.click(point.x, point.y); await p.waitForFunction(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')).thoughts.length === 1)
    await p.clock.runFor(900)
    check(`${name}: saving the first marker keeps both thought tools stationary`, stable(before, await mark.boundingBox()) && stable(writeBefore, await button(p, '记下想法').boundingBox()))
    await p.mouse.click(point.x, point.y); await p.waitForFunction(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')).thoughts.length === 2)
    check(`${name}: a second tap at the original edge creates a marker, not an editor`, await p.locator('#thought-text').count() === 0)
    if (font === 32) {
      check(`${name}: enlarged clock has its own clear region`, await p.evaluate(() => {
        const t = document.querySelector('.fp-digits').getBoundingClientRect(), c = document.querySelector('.fp-plate').getBoundingClientRect()
        return (t.bottom <= c.top || t.right <= c.left) && c.height > 40 && document.querySelector('.home').dataset.layout === 'readable'
      }))
      await p.locator('.fp-plate').evaluate(e => { e.scrollTop = 0 })
    }
    await p.screenshot({ path: path.join(output, `${name}-marked.png`) })
    await button(p, '暂停专注').focus()
    for (const next of ['结束专注', '留个标记', '记下想法']) {
      // macOS WebKit's default Tab mode skips buttons; Option-Tab includes all controls.
      await p.keyboard.press(process.env.IOS_BROWSER === 'webkit' ? 'Alt+Tab' : 'Tab')
      check(`${name}: keyboard follows the control order to ${next}`, await button(p, next).evaluate(e => e === document.activeElement))
    }
    await button(p, '记下想法').click(); await p.locator('#thought-text').fill(`想法 ${name}`)
    const dialog = p.getByRole('dialog'); const close = dialog.locator('.focus-panel__header button')
    check(`${name}: editor has a reachable close action`, await close.evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 }))
    await p.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
    await p.locator('.fp-plate').evaluate(e => { e.scrollTop = 0 })
    check(`${name}: closing editor returns to an unobscured running timer`, await button(p, '暂停专注').count() === 1)
    await ctx.close()
  }
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  const p = await ctx.newPage(); watch(p, 'connected journeys')
  await p.clock.install({ time: new Date('2026-11-07T04:00:00+08:00') }); await p.goto(url)
  await button(p, '开始专注').waitFor(); await p.evaluate(() => navigator.serviceWorker.ready)
  check('New installation remains quiet on Focus', await p.locator('.fp-note').isHidden())
  await button(p, '设置').click()
  const status = p.locator('details').filter({ has: p.locator('summary', { hasText: '应用状态' }) })
  await status.locator('summary').click()
  check('Settings keeps offline readiness available', (await status.innerText()).includes('已准备好离线使用'))
  await p.screenshot({ path: path.join(output, 'settings.png') }); await button(p, '‹ 回到专注').click()
  await p.getByRole('button', { name: /^调整专注时长/ }).click(); await p.locator('#custom-minutes').fill('1'); await button(p, '用这个时长').click()
  await button(p, '开始专注').click(); await button(p, '暂停专注').waitFor(); await p.clock.fastForward(60100)
  await button(p, '准备专注').waitFor(); const finished = (await snapshot(p)).records[0].sessionId
  await p.reload(); await button(p, '准备专注').waitFor()
  check('A recent automatic suggestion retains its actual result after reload', (await snapshot(p)).restSuggestionSessionId === finished)
  await button(p, '准备专注').click(); await button(p, '选择休息').click(); await button(p, '开始休息').waitFor()
  await p.reload(); await button(p, '开始休息').waitFor()
  check('Explicit rest preparation never resurrects an old focus result', await button(p, '返回专注').count() === 1 && !await button(p, '准备专注').count())
  await p.clock.fastForward(3601000); await p.reload(); await button(p, '开始休息').waitFor()
  check('Explicit rest remains selected after the automatic suggestion cutoff', (await snapshot(p)).timer.phase === 'shortBreak')
  await button(p, '返回专注').click()
  let reviewedDusk = false
  for (let i = 0; i < 9; i++) {
    await button(p, '开始专注').click(); await button(p, '暂停专注').waitFor()
    if (await p.locator('.home').getAttribute('data-setting') === 'dusk') {
      await button(p, '暂停专注').click(); await button(p, '继续专注').waitFor()
      const colors = await p.evaluate(() => [getComputedStyle(document.querySelector('.fp-digits')).color, getComputedStyle(document.querySelector('.fp-scene')).backgroundColor])
      const luminance = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0)
      const values = colors.map(luminance).sort((a, b) => b - a)
      check('Dusk countdown meets at least 4.5:1 contrast', (values[0] + .05) / (values[1] + .05) >= 4.5)
      await p.screenshot({ path: path.join(output, 'dusk-paused.png') }); reviewedDusk = true; break
    }
    await button(p, '结束专注').click(); await button(p, '确认结束').click(); await button(p, '准备专注').click()
  }
  check('The dusk scene was reached and reviewed', reviewedDusk)
  await button(p, '记录').click(); await p.screenshot({ path: path.join(output, 'records.png') })
  check('No browser or console errors', errors.length === 0)
  await ctx.close()
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors }, null, 2))
  await browser.close(); await new Promise(resolve => server.httpServer.close(resolve))
}
