import assert from 'node:assert/strict'
import { prepareMinutes } from './focus-duration-actions.mjs'

const startedAt = Date.parse('2026-11-26T14:00:00+08:00')
const minute = 60_000
const button = (page, name) => page.getByRole('button', { name, exact: true })
const snapshot = page => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')))
const stage = (page, value) => page.locator(`.home [data-scene-part="book"][data-reading-stage="${value}"]`)
const roomTicket = page => page.locator('#root [data-jl-bookmark-source]')

async function profile(browser, width, state) {
  return browser.newContext({
    viewport: { width, height: 812 }, reducedMotion: 'reduce', locale: 'zh-CN',
    timezoneId: 'Asia/Singapore', storageState: state, serviceWorkers: 'block',
  })
}

// Take a starting fixture from the production controls and real activity bag.
// Branching from this saved profile gives the same book, session and original plan.
async function beginReading(browser, url, minutes) {
  const context = await profile(browser, 375)
  try {
    const page = await context.newPage()
    await page.clock.setFixedTime(startedAt)
    await page.goto(url)
    if (minutes !== 25) await prepareMinutes(page, minutes)
    for (let i = 0; i < 8; i++) {
      await button(page, '开始专注').click()
      await button(page, '暂停专注').waitFor()
      const session = (await snapshot(page)).timer.session
      if (session.scene.sceneId === 'F3') {
        assert.equal(session.reading.variant, minutes === 1 ? 'hat' : 'chapter')
        return { state: await context.storageState(), id: session.id }
      }
      await button(page, '结束专注').click()
      await button(page, '确认结束').click()
      await button(page, '准备专注').click()
    }
    assert.fail('The eight-activity bag did not include reading')
  } finally {
    await context.close()
  }
}

async function visit(browser, url, fixture, width, elapsed, action, { runClock = false } = {}) {
  const context = await profile(browser, width, fixture.state)
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(7000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    if (runClock) await page.clock.install({ time: startedAt + elapsed })
    else await page.clock.setFixedTime(startedAt + elapsed)
    await page.goto(url)
    await action(page)
    assert.deepEqual(errors, [])
  } finally {
    await context.close()
  }
}

async function openMemory(page, sessionId) {
  await button(page, '记录').click()
  await page.getByRole('tab', { name: '手记', exact: true }).click()
  const leaf = page.locator('#root .jl-memory-leaf')
  // setup can create zero-second records at the same initial clock instant;
  // the record under test ends strictly later.
  await leaf.locator('.jl-story-title').waitFor()
  assert.equal(await leaf.getAttribute('data-record-id'), sessionId)
  return leaf
}

export async function checkReadingChapter(browser, url) {
  const chapter = await beginReading(browser, url, 25)
  await visit(browser, url, chapter, 375, 21.25 * minute, async page => {
    await stage(page, 'linger').waitFor()
    await page.locator('[data-scene-part="reading-ticket"]').first().waitFor()
    await button(page, '暂停专注').click()
    await page.getByRole('dialog', { name: '专注工具' }).waitFor()
    await page.clock.setFixedTime(startedAt + 24 * minute)
    await page.reload()
    await stage(page, 'linger').waitFor()
    await button(page, '结束专注').click()
    await button(page, '确认结束').click()
    await button(page, '准备专注').waitFor()
    assert.match(await page.locator('.fp-status').innerText(), /本段计时 21 分钟 15 秒 · 已保存/)
    assert.equal(await page.getByRole('combobox', { name: '休息时长' }).inputValue(), 'shortBreak')
    const leaf = await openMemory(page, chapter.id)
    assert.match(await leaf.innerText(), /又念了一遍/)
    await page.getByRole('tab', { name: '小屋', exact: true }).click()
    assert.equal(await roomTicket(page).count(), 0)
    assert.equal(await page.locator('[data-jl-source="F3"]').count(), 1)
  })

  await visit(browser, url, chapter, 430, 25 * minute + 1, async page => {
    await stage(page, 'closed').waitFor()
    await openMemory(page, chapter.id)
    await page.getByRole('tab', { name: '小屋', exact: true }).click()
    await roomTicket(page).focus()
    await roomTicket(page).press('Enter')
    assert.equal(await page.locator('#root .jl-memory-leaf').getAttribute('data-record-id'), chapter.id)
    await page.locator('#root [data-jl-back]').click()
    await roomTicket(page).waitFor()
    assert(await roomTicket(page).evaluate(el => el === document.activeElement))
  })

  await visit(browser, url, chapter, 320, 8 * minute, async page => {
    await page.getByRole('button', { name: /^调整专注剩余时间/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox').fill('10')
    await button(dialog, '从现在起再计 10 分钟').click()
    await dialog.waitFor({ state: 'hidden' })
    await page.clock.setFixedTime(startedAt + 18 * minute + 1)
    await page.reload()
    await stage(page, 'later').waitFor()
    await openMemory(page, chapter.id)
    const record = (await snapshot(page)).records.find(r => r.sessionId === chapter.id)
    assert.equal(record.endReason, 'deadline')
    assert.equal(record.elapsedMs, 18 * minute)
    assert.equal(record.reading.archive, 'note')
    await page.getByRole('tab', { name: '小屋', exact: true }).click()
    assert.equal(await roomTicket(page).count(), 0)
  })

  const hat = await beginReading(browser, url, 1)
  await visit(browser, url, hat, 320, 0, async page => {
    await page.locator('[data-scene-part="reading-dog"][data-cap="worn"]').waitFor()
    await page.clock.fastForward(50_000)
    await page.locator('[data-scene-part="reading-dog"][data-cap="carried"]').waitFor()
    await page.clock.fastForward(10_001)
    await stage(page, 'found').waitFor()
    await button(page, '准备专注').waitFor()
    const leaf = await openMemory(page, hat.id)
    await leaf.locator('[data-reading-art="dog-found"]').waitFor()
    await leaf.locator('.jl-reading-excerpt').waitFor()
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
    assert(await leaf.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    await page.getByRole('tab', { name: '小屋', exact: true }).click()
    assert.equal(await roomTicket(page).count(), 0)
  }, { runClock: true })
  console.log('PASS reading chapters: pause, manual and deadline endings, shortened clock, ticket source, illustrated hat, 320/375/430px and reduced motion')
}
