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
    await context.addInitScript(() => setInterval(() =>
      document.querySelector('.fp-plate')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), 100))
    return context
  }
  return browser
}
