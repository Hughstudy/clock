/** Production Chromium gesture checks use real browser routing for mouse and
 * emulated touch. Each run starts with its own storage and a real clock. */
export async function checkDialGestures(browser, url, check) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.setDefaultTimeout(6000)
    await page.goto(url)
    const primary = page.locator('.fp-primary button'), dial = page.getByRole('dialog', { name: '调专注时长' })
    const trigger = page.getByRole('button', { name: /^调整专注时长/ })
    const value = page.getByRole('textbox', { name: '专注分钟数' })
    const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot'))?.timer.session)
    const cdp = await context.newCDPSession(page)
    const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: point ? [{ x: point.x, y: point.y, id: 1 }] : [],
    })
    await primary.waitFor()

    const box = await primary.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(700)
    check('A long press on start does not open the dial', !await dial.count() && !await session())
    await page.mouse.up()
    await page.getByRole('button', { name: '暂停专注', exact: true }).waitFor()
    check('Releasing that press simply starts the focus', (await session())?.status === 'running')
    await page.getByRole('button', { name: '结束专注', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认结束', exact: true }).click()
    await page.getByRole('button', { name: '准备专注', exact: true }).click()

    await trigger.click()
    await dial.waitFor()
    const rect = await page.getByRole('slider', { name: '时长表盘' }).boundingBox()
    const origin = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, r = rect.width * .42
    const onRing = minute => ({ x: origin.x + r * Math.sin(minute * Math.PI / 30), y: origin.y - r * Math.cos(minute * Math.PI / 30) })
    const tapRing = async minute => { await touch('touchStart', onRing(minute)); await touch('touchEnd') }

    await touch('touchStart', onRing(57))
    for (let minute = 58; minute <= 63; minute++) await touch('touchMove', onRing(minute))
    await touch('touchEnd')
    check('A drag lands the hand on the finger and crosses twelve into the next lap', await value.inputValue() === '63')
    await tapRing(15)
    check('A tap stays on the current lap above 60 minutes', await value.inputValue() === '75')
    await touch('touchStart', origin)
    await touch('touchEnd')
    check('A tap on the hub changes nothing', await value.inputValue() === '75')
    await value.fill('25')
    await tapRing(45)
    check('A tap on 45 sets 45 minutes without starting', await value.inputValue() === '45' && await dial.isVisible() && !await session())
    await tapRing(0)
    check('A tap on the top mark sets 60 minutes', await value.inputValue() === '60')
    await tapRing(1)
    await touch('touchStart', onRing(1))
    for (let minute = 0; minute >= -4; minute--) await touch('touchMove', onRing(minute))
    await page.waitForTimeout(100) // Chromium delivers the last touch move on the next frame.
    check('Turning below the minimum holds at 1 minute', await value.inputValue() === '1')
    await touch('touchMove', onRing(1))
    await touch('touchMove', onRing(10))
    await touch('touchEnd')
    check('The hand rejoins the finger after passing the minimum', await value.inputValue() === '10')
    await touch('touchStart', onRing(10))
    await touch('touchCancel')
    await dial.getByRole('button', { name: '取消', exact: true }).click()
    check('Cancel restores the original 25-minute preparation', await page.locator('.fp-digits').innerText() === '25:00' && !await session())

    await trigger.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('slider', { name: '时长表盘' }).press('ArrowRight')
    await dial.getByRole('button', { name: '用这个时长' }).click()
    check('Keyboard selection prepares 26 minutes without starting', await page.locator('.fp-digits').innerText() === '26:00' && !await session())

    const peer = await context.newPage()
    await peer.goto(url)
    await trigger.click()
    await dial.waitFor()
    await peer.getByRole('button', { name: '开始专注', exact: true }).click()
    await dial.waitFor({ state: 'hidden' })
    check('Another tab starting closes the dial without pausing the new session',
      (await session())?.status === 'running' && await primary.innerText() === '暂停专注')
    check('Dial gestures produce no browser runtime or console errors', errors.length === 0)
  } finally { await context.close() }
}
