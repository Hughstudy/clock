import { chromium } from 'playwright'

/** One browser selection policy for production checks and artwork review. */
export function launchChromium() {
  const executablePath = process.env.SCENE_BROWSER_EXECUTABLE
  const channel = process.env.SCENE_BROWSER_CHANNEL
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : channel ? { channel } : {}),
  })
}

/** Checks about the controls themselves act on the Focus card long after a session starts. A
 * repeated synthetic press keeps it on screen; verify-focus-step-aside.mjs covers it leaving. */
export function holdFocusCard(browser) {
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async (...args) => {
    const context = await newContext(...args)
    await context.addInitScript(() => setInterval(() => {
      if (!document.querySelector('.home [role="dialog"], .home dialog[open]')) {
        document.querySelector('.fp-plate')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      }
    }, 100))
    return context
  }
  return browser
}

/** Enter the real paused tools flow. Tests on an ended session must explicitly
 * choose their next activity before calling this helper. */
export async function showFocusTools(page) {
  const dialog = page.getByRole('dialog', { name: '专注工具', exact: true })
  const reopen = page.getByRole('button', { name: '专注工具', exact: true })
  const start = page.getByRole('button', { name: /^(开始专注|开始休息)$/ })
  const pause = page.getByRole('button', { name: /^暂停(专注|休息)$/ })
  const handle = page.locator('.fp-handle')
  await dialog.or(reopen).or(start).or(pause).or(handle).first().waitFor()
  if (await dialog.isVisible()) return dialog
  if (await reopen.isVisible()) await reopen.click()
  else {
    if (await start.isVisible()) await start.click()
    if (await handle.isVisible()) await handle.click()
    await pause.click()
  }
  await dialog.waitFor()
  return dialog
}
