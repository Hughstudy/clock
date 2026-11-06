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
