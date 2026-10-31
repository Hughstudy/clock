import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { build, createServer, preview } from 'vite'
import react from '@vitejs/plugin-react'

// Build the current app in an isolated directory; never reuse a stale dist.
const output = path.resolve(process.env.SCENERY_REVIEW_OUTPUT || '.preview/scenery-review')
const outDir = path.resolve('.preview/scenery-build')
const widths = [320, 375, 430]
const samples = [
  { id: '', label: 'Ready', scenery: 'workroom' },
  { id: 'F4', label: 'Tea', scenery: 'workroom' },
  { id: 'F2', label: 'Plant', scenery: 'garden' },
  { id: 'F8', label: 'Stars', scenery: 'dusk' },
]
const captured = new Map()
const checks = []
const errors = []
function check(label, condition) {
  assert.ok(condition, label)
  checks.push(label)
}
function observe(page) {
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
}

async function captureWidths(page, sample) {
  const frames = []
  const stage = page.locator('.home .stage')
  const svg = stage.locator('.blue-companion')
  await svg.locator(`[data-scenery="${sample.scenery}"]`).waitFor()
  for (const width of widths) {
    await page.setViewportSize({ width, height: 820 })
    const offlineNotice = page.getByRole('button', { name: '知道了', exact: true })
    if (await offlineNotice.isVisible()) await offlineNotice.click()
    await stage.scrollIntoViewIfNeeded()
    const metrics = await svg.evaluate(el => {
      const badge = document.querySelector('.clock-badge').getBoundingClientRect()
      const foreground = [...el.querySelectorAll('[data-part^="eye"],[data-part^="mouth"],[data-scene-hand]')]
      const overlapsBadge = foreground.some(node => {
        const r = node.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && r.left < badge.right && r.right > badge.left && r.top < badge.bottom && r.bottom > badge.top
      })
      return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, overlapsBadge, foreground: foreground.length }
    })
    check(`${sample.label} at ${width}px fits without clock overlap`, metrics.width === width && !metrics.overflow && metrics.foreground > 0 && !metrics.overlapsBadge)
    frames.push(await stage.screenshot())
    if (width === 375 && (sample.id === '' || sample.id === 'F4')) {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: path.join(output, `app-${sample.label.toLowerCase()}-375.png`) })
    }
  }
  captured.set(sample.id, frames)
}

async function contactSheet(browser) {
  const sheet = await browser.newPage({ viewport: { width: 1200, height: 840 } })
  try {
    const figures = samples.flatMap(sample => captured.get(sample.id).map((png, index) =>
      `<figure><figcaption>${sample.label} · ${widths[index]} CSS px</figcaption><img src="data:image/png;base64,${png.toString('base64')}"></figure>`))
    await sheet.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#eef2f5;color:#273f54;font:15px system-ui}
      main{display:grid;grid-template-columns:320px 375px 430px;gap:12px;width:max-content;padding:14px}
      figure{margin:0;border-radius:12px;background:white;overflow:hidden;text-align:center}figcaption{padding:8px;font-weight:600}
      img{display:block;margin:auto}</style><main>${figures.join('')}</main>`)
    await sheet.locator('main').screenshot({ path: path.join(output, 'scenery-widths.png') })
  } finally {
    await sheet.close()
  }
}

await mkdir(output, { recursive: true })
process.env.BASE_PATH = '/clock/'
await build({ build: { outDir } })
const app = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
let fixture
let browser
try {
  fixture = await createServer({ configFile: false, root: path.resolve('preview/animation'), plugins: [react()], server: { host: '127.0.0.1', port: 0 } })
  await fixture.listen()
  browser = await chromium.launch({ headless: true, channel: process.env.SCENE_BROWSER_CHANNEL, executablePath: process.env.SCENE_BROWSER_EXECUTABLE })
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' })
  observe(page)
  await page.goto(`http://127.0.0.1:${fixture.httpServer.address().port}/`)
  const fixtureSvg = page.locator('.preview__phone .blue-companion')
  const gallery = page.getByRole('region', { name: 'All static session activities' })
  const catalogue = gallery.locator('svg.blue-companion')
  await catalogue.first().waitFor()
  await gallery.screenshot({ path: path.join(output, 'scenery-catalogue.png') })
  const scenes = await catalogue.evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.scene,
    scenery: [...node.querySelectorAll('[data-scenery]')].map(layer => layer.dataset.scenery),
  })))
  check('Every focus and rest activity contains one recognizable setting',
    new Set(scenes.map(scene => scene.id)).size === 11 && scenes.every(scene =>
      scene.scenery.length === 1 && samples.some(sample => sample.scenery === scene.scenery[0])))
  for (const sample of samples) {
    await page.getByLabel('Scene', { exact: true }).selectOption(sample.id)
    const backdrop = fixtureSvg.locator(`[data-scenery="${sample.scenery}"]`)
    await backdrop.waitFor()
    const result = await backdrop.evaluate(node => {
      const body = node.ownerSVGElement.querySelector('[data-part="body"]')
      return {
        behind: Boolean(body && (node.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING)),
        decorative: !!node.closest('[aria-hidden="true"]') && getComputedStyle(node).pointerEvents === 'none',
        animations: node.getAnimations({ subtree: true }).length,
      }
    })
    check(`${sample.label} has a static, decorative layer behind the character`, result.behind && result.decorative && result.animations === 0)
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('.preview__phone .blue-companion[data-static="true"]').waitFor()
  check('Reduced motion retains the dusk illustration and stops scene animation',
    await fixtureSvg.locator('[data-scenery="dusk"]').isVisible() && await fixtureSvg.evaluate(el => el.getAnimations({ subtree: true }).length === 0))
  await page.close()

  const real = await browser.newPage({ viewport: { width: 375, height: 820 }, colorScheme: 'light', reducedMotion: 'reduce' })
  observe(real)
  await real.goto(`http://127.0.0.1:${app.httpServer.address().port}/clock/`)
  await captureWidths(real, samples[0])
  const primary = real.locator('.home .btn-primary')
  const running = real.locator('.home .blue-companion[data-scene-status="running"]')
  // The saved focus bag makes all three activities reachable in eight normal starts.
  for (let attempt = 0; attempt < 8 && captured.size < samples.length; attempt++) {
    await primary.click()
    await running.waitFor()
    const id = await running.getAttribute('data-scene')
    if (attempt === 0) {
      const scenery = await running.locator('[data-scenery]').getAttribute('data-scenery')
      await primary.click()
      await real.locator('.home .blue-companion[data-scene-status="paused"]').waitFor()
      await primary.focus()
      await real.keyboard.press('Enter')
      await running.waitFor()
      check('Pause and keyboard resume retain the same scene and backdrop',
        await running.getAttribute('data-scene') === id && await running.locator('[data-scenery]').getAttribute('data-scenery') === scenery)
    }
    const sample = samples.find(entry => entry.id === id)
    if (sample && !captured.has(id)) await captureWidths(real, sample)
    await real.getByRole('button', { name: '结束并记录', exact: true }).click()
    await real.getByRole('button', { name: '确认结束并记录', exact: true }).click()
    await real.locator('.home .blue-companion[data-scene-status="ended"]').waitFor()
  }
  check('Captured ready, workroom, garden and dusk from the actual timer', captured.size === samples.length)
  assert.deepEqual(errors, [], 'Browser and console errors')
  await contactSheet(browser)
  const report = { browser: browser.version(), widths, productionScreenshots: { colorScheme: 'light', reducedMotion: 'reduce' }, scenes, checks, errors }
  await writeFile(path.join(output, 'scenery-review.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`${checks.length} scenery checks passed in Chromium ${report.browser}. Evidence: ${output}`)
} finally {
  await browser?.close()
  await fixture?.close()
  await app.close()
}
