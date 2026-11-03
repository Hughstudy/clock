import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { focusTime, prepareMinutes } from './focus-dial-actions.mjs'

// Run against the local development or production preview server supplied by
// the caller. Each context is isolated from the user's application storage.
const url = process.env.FOCUS_V35_URL || 'http://127.0.0.1:5175/'
const browser = await chromium.launch({ channel: process.env.SCENE_BROWSER_CHANNEL })
const errors = []
const checks = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const snapshot = page => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')))
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', timezoneId: 'Asia/Singapore' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(8000)
  await page.clock.install({ time: new Date('2026-11-02T18:00:00+08:00') })
  await page.goto(url)
  await button(page, '开始专注').waitFor()
  const dismissNotice = button(page, '知道了')
  if (await dismissNotice.isVisible()) await dismissNotice.click()

  await prepareMinutes(page, 15)
  check('Choosing a length does not start a session', !(await snapshot(page))?.timer.session)
  await button(page, '给我一句鼓励').click()
  const reader = page.getByRole('region', { name: '一句鼓励' })
  const quote = page.locator('.fp-reader-quote:visible')
  const firstQuote = await quote.innerText()
  await button(reader, '换一种鼓励').click()
  check('Category selection replaces quote reading', await quote.count() === 0)
  await button(reader, '日常鼓励').click()
  check('Choosing current category keeps the same quote', await quote.innerText() === firstQuote)
  await button(reader, '换一种鼓励').click()
  await page.keyboard.press('Escape')
  check('Escape from categories returns to the same quote', await quote.innerText() === firstQuote)
  await button(reader, '换一种鼓励').click()
  await page.goBack()
  await quote.waitFor()
  check('Browser Back from categories preserves reader', await reader.count() === 1 && await quote.innerText() === firstQuote)
  await page.goBack()
  await reader.waitFor({ state: 'hidden' })
  check('A second browser Back closes the reader', await button(page, '给我一句鼓励').evaluate(element => document.activeElement === element))

  await button(page, '记下想法').click()
  await page.locator('#thought-text').fill('稍后取快递')
  await button(page, '给我一句鼓励').click()
  check('Switching from writing to encouragement keeps one active reader', await reader.count() === 1 && await page.locator('#thought-text').count() === 0)
  await button(page, '收到鼓励了').click()
  await button(page, '继续草稿').click()
  check('Switching tasks preserves the original draft', await page.locator('#thought-text').inputValue() === '稍后取快递')
  await page.keyboard.press('Escape')

  await button(page, '开始专注').click()
  await button(page, '暂停专注').waitFor()
  check('End is in the timer control group, outside thoughts', await page.locator('.fp-controls').getByRole('button', { name: '结束专注', exact: true }).count() === 1 && await page.locator('.fp-thought-tools').getByRole('button', { name: '结束专注', exact: true }).count() === 0)
  await button(page, '结束专注').click()
  await button(page.getByRole('dialog'), '确认结束').click()
  await button(page, '准备专注').waitFor()
  const endedCount = (await snapshot(page)).records.length
  await button(page, '留个标记').click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')).thoughts.some(thought => thought.text === '' && thought.sessionId === null))
  check('Result state can create an independent marker', (await snapshot(page)).thoughts.some(thought => thought.text === '' && thought.sessionId === null))
  await button(page, '准备专注').click()
  await button(page, '开始专注').waitFor()
  check('Preparing the next focus does not start it', !(await snapshot(page)).timer.session && (await snapshot(page)).records.length === endedCount)

  await focusTime(page).click()
  await page.locator('#custom-minutes').fill('1')
  await button(page.getByRole('dialog'), '用这个时长').click()
  await button(page, '开始专注').click()
  await button(page, '结束专注').click()
  await page.clock.fastForward(61_000)
  await page.getByText('本次专注已结束。可以返回查看实际计时和保存状态。', { exact: true }).waitFor()
  check('Expiry keeps confirmation layer with a return action', await page.getByRole('dialog').count() === 1 && await button(page.getByRole('dialog'), '确认结束').count() === 0)
  await button(page.getByRole('dialog'), '返回计时').click()
  check('Expiry settles once without starting rest', !(await snapshot(page)).timer.session && (await snapshot(page)).records.length === endedCount + 1)

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 812 })
    const small = await page.locator('.home button').evaluateAll(buttons => buttons.filter(element => {
      const box = element.getBoundingClientRect()
      return element.getClientRects().length && box.width > 0 && box.height > 0 && (box.width < 43.9 || box.height < 43.9)
    }).map(element => ({ label: element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
    check(`${width}px Focus buttons have native 44px targets: ${JSON.stringify(small)}`, small.length === 0)
  }
  check(`No page errors: ${errors.join('; ')}`, errors.length === 0)
  console.log(`${checks.length} Focus v35 checks passed`)
} finally {
  await browser.close()
}
