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
    const primary = page.locator('.fp-primary button'), dial = page.getByRole('dialog', { name: '调这一次的时长' })
    const value = page.getByRole('textbox', { name: '专注分钟数' })
    const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot'))?.timer.session)
    const cdp = await context.newCDPSession(page)
    const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: point ? [{ x: point.x, y: point.y, id: 1 }] : [],
    })
    function center(rect) { return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } }
    function onRing(origin, radius, angle) {
      return { x: origin.x + radius * Math.sin(angle), y: origin.y - radius * Math.cos(angle) }
    }
    await primary.waitFor()
    const anchor = center(await primary.boundingBox())
    await touch('touchStart', anchor)
    await dial.waitFor()
    const rect = await page.getByRole('slider', { name: '时长表盘' }).boundingBox()
    const origin = center(rect), r = rect.width * .42
    const start = Math.atan2(anchor.x - origin.x, origin.y - anchor.y)
    for (let i = 0; i <= 12; i++) await touch('touchMove', onRing(origin, r, start + i * Math.PI / 24))
    await touch('touchEnd')
    check('One continuous touch holds, turns clockwise and releases into preview',
      await value.inputValue() === '40' && await dial.isVisible() && !await session())

    // Another turn begins at 57 minutes on the clock face and crosses twelve.
    await touch('touchStart', onRing(origin,r,-Math.PI / 10))
    for (let i = 1; i <= 6; i++) await touch('touchMove',onRing(origin,r,(-3 + i) * Math.PI / 30))
    await touch('touchEnd')
    check('Dragging across twelve advances continuously', await value.inputValue() === '46')
    await dial.getByRole('button', { name: '取消', exact: true }).click()
    check('Cancel restores the original 25-minute preparation', await page.locator('.fp-digits').innerText() === '25:00' && !await session())

    await touch('touchStart', anchor)
    await dial.waitFor()
    await touch('touchCancel')
    await dial.waitFor({ state: 'hidden' })
    check('System pointer cancellation consumes the held start', !await session() && await page.locator('.fp-digits').innerText() === '25:00')

    await touch('touchStart', anchor)
    await dial.waitFor()
    // A different input modality can explicitly switch tasks while the
    // original touch remains down. Its late cancellation belongs to the dial.
    await page.getByRole('button', { name: '给我一句鼓励', exact: true }).press('Enter')
    await dial.waitFor({ state: 'hidden' })
    await touch('touchCancel')
    const dismiss = page.getByRole('button', { name: '收到鼓励了', exact: true })
    check('A late touch cancellation preserves the new encouragement reader', await dismiss.isVisible() && !await session())
    await dismiss.click()

    await page.mouse.move(anchor.x, anchor.y)
    await page.mouse.down()
    await dial.waitFor()
    await page.mouse.up()
    check('Mouse hold without movement never starts the clock', await dial.isVisible() && await value.inputValue() === '25' && !await session())
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /调整专注时长/ }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('slider', { name: '时长表盘' }).press('ArrowRight')
    await dial.getByRole('button', { name: '用这个时长' }).click()
    check('Keyboard selection prepares 26 minutes without starting', await page.locator('.fp-digits').innerText() === '26:00' && !await session())

    const peer = await context.newPage()
    await peer.goto(url)
    await touch('touchStart', anchor)
    await dial.waitFor()
    await peer.getByRole('button', { name: '开始专注', exact: true }).click()
    await dial.waitFor({ state: 'hidden' })
    await touch('touchEnd')
    check('Another tab starting during the hold closes the dial without pausing the new session',
      (await session())?.status === 'running' && await primary.innerText() === '暂停专注')
    check('Dial gestures produce no browser runtime or console errors', errors.length === 0)
  } finally { await context.close() }
}
