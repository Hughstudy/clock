/** Production Chromium checks use real browser routing for mouse, keyboard and
 * emulated touch. Each run starts with its own storage and a real clock. */
export async function checkDurationRuler(browser, url, check) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.setDefaultTimeout(6000)
    await page.goto(url)
    const primary = page.locator('.fp-primary button'), picker = page.getByRole('dialog', { name: '调专注时长' })
    const trigger = page.getByRole('button', { name: /^调整专注时长/ })
    const value = page.getByRole('textbox', { name: '专注分钟数' })
    const ruler = page.getByRole('slider', { name: '时长刻度尺' })
    const digits = page.locator('.fp-digits')
    const offset = () => ruler.evaluate(element => element.scrollLeft)
    const settled = async () => { let last = -1; for (let i = 0; i < 40; i++) { const now = await offset(); if (now === last) return now; last = now; await page.waitForTimeout(80) } return last }
    const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot'))?.timer.session)
    await primary.waitFor()

    const box = await primary.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(700)
    check('A long press on start does not open the ruler', !await picker.count() && !await session())
    await page.mouse.up()
    await page.getByRole('button', { name: '暂停专注', exact: true }).waitFor()
    check('Releasing that press simply starts the focus', (await session())?.status === 'running')
    await page.getByRole('button', { name: '结束专注', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认结束', exact: true }).click()
    await page.getByRole('button', { name: '准备专注', exact: true }).click()

    await trigger.click()
    await picker.waitFor()
    await page.waitForFunction(() => document.querySelector('[role=slider]')?.scrollLeft > 0)
    check('The ruler opens on the current length', await offset() === 240 && await value.inputValue() === '25')
    const rect = await ruler.boundingBox()
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }

    const cdp = await context.newCDPSession(page)
    const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y: center.y, id: 1 }] })
    await touch('touchStart', center.x)
    for (let x = center.x; x >= center.x - 150; x -= 10) { await touch('touchMove', x); await page.waitForTimeout(16) }
    await touch('touchEnd')
    const swiped = await settled()
    check('A touch swipe moves the length and snaps to a whole minute', swiped > 240 && swiped % 10 === 0 && await value.inputValue() === String(swiped / 10 + 1))
    check('The large time follows the ruler', (await digits.innerText()).startsWith(String(swiped / 10 + 1).padStart(2, '0')) && !await session())

    await value.fill('25')
    await page.mouse.click(center.x + 50, center.y)
    await settled()
    check('A click on a tick moves straight to it', await value.inputValue() === '30')
    await page.mouse.move(center.x, center.y)
    await page.mouse.down()
    await page.mouse.move(center.x - 100, center.y, { steps: 5 })
    await page.mouse.up()
    await settled()
    check('A mouse drag moves the ruler without counting as a click', await value.inputValue() === '40')
    await page.mouse.wheel(0, 100)
    await settled()
    check('A mouse wheel steps one minute', await value.inputValue() === '41')

    await ruler.focus()
    await page.keyboard.press('ArrowRight')
    check('An arrow key steps one minute', await value.inputValue() === '42' && await offset() === 410)
    await page.keyboard.press('PageDown')
    check('Page keys step five minutes', await value.inputValue() === '37')
    await page.keyboard.press('Home')
    check('Home goes to the minimum', await value.inputValue() === '1' && await offset() === 0)
    await page.keyboard.press('ArrowLeft')
    check('The minimum holds', await value.inputValue() === '1')
    await page.keyboard.press('End')
    check('End goes to the maximum', await value.inputValue() === '120' && await offset() === 1190)
    await page.keyboard.press('ArrowRight')
    check('The maximum holds', await value.inputValue() === '120')
    await page.keyboard.press('ArrowLeft')
    check('Turning back from the limit responds at once', await value.inputValue() === '119')

    await value.fill('90')
    await page.waitForTimeout(100)
    check('Typed minutes move the ruler', await offset() === 890 && await value.inputValue() === '90')
    await value.fill('200')
    await page.waitForTimeout(100)
    check('An invalid entry leaves the ruler alone and blocks applying', await offset() === 890 && await value.inputValue() === '200' && await picker.getByRole('button', { name: '用这个时长' }).isDisabled())
    await value.fill('')
    await page.waitForTimeout(100)
    check('An empty entry stays editable', await value.inputValue() === '' && await offset() === 890)

    await picker.getByRole('button', { name: '取消', exact: true }).click()
    check('Cancel restores the original 25-minute preparation', await digits.innerText() === '25:00' && !await session())

    await trigger.focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'slider')
    await page.keyboard.press('ArrowRight')
    await picker.getByRole('button', { name: '用这个时长' }).click()
    check('Keyboard selection prepares 26 minutes without starting', await digits.innerText() === '26:00' && !await session())
    await trigger.click()
    await page.waitForFunction(() => document.querySelector('[role=slider]')?.scrollLeft === 250)
    check('Reopening shows the chosen length', await value.inputValue() === '26')

    await page.setViewportSize({ width: 320, height: 568 })
    await page.waitForTimeout(200)
    const small = await picker.getByRole('button', { name: '用这个时长' }).boundingBox(), nav = await page.locator('.tab-bar').boundingBox()
    check('A resize keeps the length and the apply button clear of navigation', await offset() === 250 && await value.inputValue() === '26' && small.y + small.height <= nav.y)
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    await page.waitForTimeout(250)
    check('Enlarged text keeps the same length, with no sideways page scroll', await value.inputValue() === '26' && await offset() === 250
      && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.evaluate(() => { document.documentElement.style.fontSize = '' })
    for (const size of [{ width: 375, height: 812 }, { width: 430, height: 932 }, { width: 1280, height: 800 }, { width: 850, height: 320 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(size)
      await page.waitForTimeout(250)
      const placed = await page.evaluate(() => {
        const panel = document.querySelector('.fp-duration-surface'), apply = panel.querySelector('button[type=submit]')
        const digits = document.querySelector('.fp-digits').getBoundingClientRect(), box = panel.getBoundingClientRect()
        // The time reads above the companion; beside the scene, the ruler sits in its own column.
        const overlapsTime = box.top < digits.bottom - 1 && box.bottom > digits.top + 1 && box.left < digits.right - 1 && box.right > digits.left + 1
        if (panel.dataset.layout === 'local' && overlapsTime) return 'covers the time'
        apply.scrollIntoView({ block: 'nearest' })
        const button = apply.getBoundingClientRect(), hit = document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2)
        return hit === apply || apply.contains(hit) ? 'ok' : 'apply is covered'
      })
      check(`At ${size.width}x${size.height} the ruler leaves the time visible and its apply button reachable`, placed === 'ok' && await value.inputValue() === '26')
    }
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(200)

    const peer = await context.newPage()
    await peer.goto(url)
    await peer.getByRole('button', { name: '开始专注', exact: true }).click()
    await picker.waitFor({ state: 'hidden' })
    check('Another tab starting closes the ruler without pausing the new session',
      (await session())?.status === 'running' && await primary.innerText() === '暂停专注')
    check('The ruler produces no browser runtime or console errors', errors.length === 0)
  } finally { await context.close() }
}
