import path from 'node:path'

const key = 'whale-focus:snapshot'
const minute = 60_000
const snapshot = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)
const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' })
const focusClock = page => button(page, /^调整专注剩余时间/)
const restClock = page => button(page, /^调整休息剩余时间/)

/** Real production entry point with the ordinary card tuck, a controlled clock and shared-tab storage. */
export async function checkRemainingTime(browser, url, check, output) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Asia/Singapore',
  })
  const errors = []
  context.on('page', page => {
    page.setDefaultTimeout(6000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  })
  try {
    const page = await context.newPage()
    await page.clock.install({ time: new Date('2026-11-23T12:00:00+08:00') })
    await page.goto(url)
    const dialog = page.getByRole('dialog')
    const input = dialog.getByRole('textbox')
    const applyMinutes = async (minutes, paused = false) => {
      await input.fill(String(minutes))
      await button(dialog, `${paused ? '继续后' : '从现在起'}再计 ${minutes} 分钟`).click()
      await dialog.waitFor({ state: 'hidden' })
    }
    await button(page, '开始专注').click()
    await button(page, '暂停专注').waitFor()
    await page.evaluate(() => document.activeElement.blur())
    await page.clock.fastForward(8 * minute + 20_000)
    await page.locator('.home[data-chrome="away"]').waitFor()
    const trigger = await focusClock(page).boundingBox()
    check('The quiet active clock has a visible, touch-sized editing target',
      trigger.width >= 44 && trigger.height >= 44 && await focusClock(page).locator('.fp-clock-edit').isVisible())
    await focusClock(page).tap()
    await page.getByRole('dialog', { name: '调整专注剩余时间' }).waitFor()
    await button(dialog, '取消').click()
    await button(page, '留个标记').click()
    await button(page, '补充文字').waitFor()
    const initial = await snapshot(page)
    const original = initial.timer.session
    await focusClock(page).click()
    await input.fill('0')
    check('An invalid remaining value leaves the active schedule intact',
      await dialog.locator('button[type="submit"]').isDisabled() && (await snapshot(page)).timer.session.deadline === original.deadline)
    await applyMinutes(10)
    const adjusted = await snapshot(page)
    const current = adjusted.timer.session
    check('A running edit uses its commit instant and keeps precisely the elapsed milliseconds, identity, scene, marker and original plan',
      current.status === 'running' && current.id === original.id && current.startedAt === original.startedAt &&
      current.initialDurationMs === 25 * minute && current.durationMs === current.deadline - original.startedAt &&
      current.runStartRemainingMs === 10 * minute && current.durationMs >= 18 * minute + 20_000 && current.durationMs < 19 * minute &&
      current.scene.sceneId === original.scene.sceneId && adjusted.thoughts[0].id === initial.thoughts[0].id &&
      adjusted.thoughts[0].sessionId === original.id && adjusted.participations.length === 1 &&
      !adjusted.records.length && adjusted.lastFocusMinutes === initial.lastFocusMinutes && adjusted.settings.durationsMinutes.focus === 25)
    if (output) await page.screenshot({ path: path.join(output, 'remaining-running-375.png') })

    await button(page, '暂停专注').click()
    await button(page, '继续专注').waitFor()
    const paused = (await snapshot(page)).timer.session
    const spent = paused.durationMs - paused.remainingMs
    await focusClock(page).focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'slider')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    check('Keyboard cancellation from the active ruler returns to its clock and preserves the paused remainder',
      await focusClock(page).evaluate(el => el === document.activeElement) && (await snapshot(page)).timer.session.remainingMs === paused.remainingMs)
    await focusClock(page).click()
    await input.fill('7')
    const submit = button(dialog, '继续后再计 7 分钟')
    for (const [width, height, font] of [[430, 932, ''], [375, 812, ''], [320, 568, '200%'], [375, 407, '']]) {
      await page.setViewportSize({ width, height })
      await page.evaluate(value => { document.documentElement.style.fontSize = value }, font)
      await input.focus()
      await page.clock.runFor(320)
      await submit.scrollIntoViewIfNeeded()
      const reachable = await submit.evaluate(el => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return el.contains(hit) && r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1 &&
          r.top >= 0 && r.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth
      })
      check(`At ${width}×${height} ${font || 'default'} text, the remaining-time input keeps its value and its action is reachable`,
        await input.inputValue() === '7' && reachable)
      if (output && font) await page.screenshot({ path: path.join(output, 'remaining-paused-320-large-text.png') })
    }
    await page.setViewportSize({ width: 375, height: 812 })
    await applyMinutes(7, true)
    await page.clock.fastForward(40 * minute)
    await page.reload()
    await button(page, '继续专注').waitFor()
    const restored = (await snapshot(page)).timer.session
    check('Reload and time away preserve a paused edit without resuming or charging the pause',
      restored.id === original.id && restored.status === 'paused' && restored.remainingMs === 7 * minute &&
      restored.durationMs === spent + 7 * minute && restored.initialDurationMs === original.durationMs &&
      await page.locator('.fp-digits').innerText() === '07:00')

    await focusClock(page).click()
    const peer = await context.newPage()
    await peer.clock.install({ time: new Date(await page.evaluate(() => Date.now())) })
    await peer.goto(url)
    await focusClock(peer).click()
    const peerDialog = peer.getByRole('dialog')
    await peerDialog.getByRole('textbox').fill('2')
    await button(peerDialog, '继续后再计 2 分钟').click()
    await peerDialog.waitFor({ state: 'hidden' })
    await dialog.getByText('计时安排已经变化，请返回钟面查看后再调。').waitFor()
    check('An open editor observes a competing adjustment and cannot resubmit its stale input',
      !await input.count() && (await snapshot(page)).timer.session.remainingMs === 2 * minute)
    await button(dialog, '返回计时').click()
    await peer.close()
    await button(page, '继续专注').click()
    await focusClock(page).click()
    await input.fill('9')
    await page.clock.fastForward(2 * minute + 500)
    await dialog.getByText('这段计时已结束，可以返回查看结果。').waitFor()
    const done = await snapshot(page)
    const record = done.records[0]
    check('Expiry while editing records one adjusted focus, the original and final targets, and no unattended continuation',
      !await input.count() && done.timer.session === null && done.timer.completedFocusCount === 1 &&
      done.records.length === 1 && done.participations.length === 1 && record.sessionId === original.id &&
      record.endReason === 'deadline' && record.initialDurationMs === original.durationMs &&
      record.elapsedMs === spent + 2 * minute && record.targetMs === record.elapsedMs)
    await button(dialog, '查看结果').click()

    await button(page, '开始休息').click()
    await button(page, '暂停休息').waitFor()
    const rest = (await snapshot(page)).timer.session
    await page.clock.fastForward(minute + 250)
    await restClock(page).click()
    await applyMinutes(2)
    const afterRest = (await snapshot(page)).timer.session
    await page.clock.fastForward(2 * minute + 500)
    await button(page, '开始专注').waitFor()
    const final = await snapshot(page)
    const memory = final.restMemories[0]
    check('An adjusted rest expires at its own deadline with one rest memory and unchanged focus accounting',
      afterRest.id === rest.id && afterRest.initialDurationMs === 5 * minute && final.timer.session === null &&
      final.timer.completedFocusCount === 1 && final.records.length === 1 && final.restMemories.length === 1 &&
      memory.sessionId === rest.id && memory.initialDurationMs === 5 * minute && memory.endReason === 'deadline' &&
      memory.elapsedMs === afterRest.durationMs && memory.targetMs === afterRest.durationMs)
    check('Active timing adjustments have no runtime or console errors', errors.length === 0)
  } finally { await context.close() }
}
