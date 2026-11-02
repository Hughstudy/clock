import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { build, preview } from 'vite'

const output = path.resolve(process.env.UPDATE_REVIEW_OUTPUT || '.preview/v35-update')
const outDir = path.join(output, 'build')
const checks = []
const errors = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const snapshot = page => page.evaluate(() => JSON.parse(localStorage.getItem('whale-focus:snapshot')))
const rawSnapshot = page => page.evaluate(() => localStorage.getItem('whale-focus:snapshot'))
const panel = page => page.getByRole('dialog')
async function openStatus(page) {
  if (!await panel(page).count()) await button(page, '查看状态').click()
}
async function closePanel(page) {
  if (await panel(page).count()) await page.keyboard.press('Escape')
}
async function endFocus(page) {
  await closePanel(page)
  await button(page, '结束专注').click()
  await button(panel(page), '确认结束').click()
  await button(page, '准备专注').waitFor()
}

process.env.BASE_PATH = '/clock/'
await mkdir(output, { recursive: true })
await build({ build: { outDir } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
const url = `http://127.0.0.1:${server.httpServer.address().port}/clock/`
let browser
try {
  browser = await chromium.launch({ channel: process.env.SCENE_BROWSER_CHANNEL })
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', timezoneId: 'Asia/Singapore' })
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)))
  const page = await context.newPage()
  page.setDefaultTimeout(12_000)
  await page.goto(url)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await button(page, '开始专注').waitFor()
  await page.evaluate(() => { window.updateGuardToken = 'original-document' })

  await button(page, '＋ 这一小步').click()
  await page.getByRole('textbox', { name: '这一小步', exact: true }).fill('先整理一页')
  await page.keyboard.press('Tab')
  check('Prepared step remains after leaving the field', await button(page, '这一小步：先整理一页').isVisible())

  // A real second worker is installed from changed bytes, using the same app
  // assets. Only this isolated verification build is modified.
  const workerPath = path.join(outDir, 'sw.js')
  const worker = await readFile(workerPath, 'utf8')
  await writeFile(workerPath, `${worker}\n// Guarded-update verification ${Date.now()}\n`)
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update() })
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)
  await page.locator('.fp-note').getByText('新版本已准备好', { exact: true }).waitFor()
  await openStatus(page)
  await panel(page).getByText('新版本已准备好。请先保存或处理当前输入，再更新。', { exact: true }).waitFor()
  check('A retained prepared step disables explicit update after blur', await button(panel(page), '更新并重载').isDisabled())
  check('A waiting worker does not force reload', await page.evaluate(() => window.updateGuardToken === 'original-document'))
  await closePanel(page)

  await button(page, '这一小步：先整理一页').click()
  await page.getByRole('textbox', { name: '这一小步', exact: true }).fill('')
  await page.keyboard.press('Tab')
  await button(page, '记下想法').click()
  await page.locator('#thought-text').fill('更新前保留的想法')
  await closePanel(page)
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('whale-focus:snapshot'))?.thoughtDraft?.text === '更新前保留的想法')
  await openStatus(page)
  check('A recoverable thought draft blocks update after its editor closes', await button(panel(page), '更新并重载').isDisabled())
  await closePanel(page)
  await button(page, '继续草稿').click()
  await button(panel(page), '保存想法').click()
  await panel(page).waitFor({ state: 'detached' })
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('whale-focus:snapshot'))
    return !saved.thoughtDraft && saved.thoughts.some(thought => thought.text === '更新前保留的想法')
  })

  await button(page, '开始专注').click()
  await button(page, '暂停专注').waitFor()
  const activeId = (await snapshot(page)).timer.session.id
  await openStatus(page)
  check('An active session exposes no actionable reload', await button(panel(page), '更新并重载').count() === 0)
  check('Waiting for update preserves the active session and document', (await snapshot(page)).timer.session.id === activeId && await page.evaluate(() => window.updateGuardToken === 'original-document'))
  await endFocus(page)
  await button(page, '准备专注').click()
  await openStatus(page)
  await button(panel(page), '更新并重载').waitFor({ state: 'visible' })
  check('Update becomes available only after explicit input handling and session end', await button(panel(page), '更新并重载').isEnabled())

  // Hold only this page's next lock request, letting another real tab start a
  // session before the reload check reads the authoritative shared snapshot.
  await page.evaluate(() => {
    const locks = navigator.locks
    const request = locks.request.bind(locks)
    locks.request = async (...args) => {
      locks.request = request
      await new Promise(resolve => { window.releaseUpdateCheck = resolve })
      return request(...args)
    }
  })
  await button(panel(page), '更新并重载').click()
  await page.waitForFunction(() => typeof window.releaseUpdateCheck === 'function')
  const peer = await context.newPage()
  peer.setDefaultTimeout(12_000)
  await peer.goto(url)
  await button(peer, '开始专注').click()
  await button(peer, '暂停专注').waitFor()
  const peerSessionId = (await snapshot(peer)).timer.session.id
  await page.evaluate(() => window.releaseUpdateCheck())
  await button(page, '暂停专注').waitFor()
  check('The final reload check rejects a session started by another tab', (await snapshot(page)).timer.session.id === peerSessionId && await page.evaluate(() => window.updateGuardToken === 'original-document'))
  await endFocus(peer)
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('whale-focus:snapshot')).timer.session)
  await peer.close()
  await page.bringToFront()
  const beforeReload = await snapshot(page)
  await button(panel(page), '更新并重载').waitFor({ state: 'visible' })
  assert.ok(await button(panel(page), '更新并重载').isEnabled())
  await Promise.all([
    page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() }),
    button(panel(page), '更新并重载').click(),
  ])
  await button(page, '开始专注').waitFor()
  const afterReload = await snapshot(page)
  check('An explicit safe update reloads the document', await page.evaluate(() => window.updateGuardToken === undefined))
  check('Update retains saved notes and both ended sessions without duplication', afterReload.records.length === beforeReload.records.length && afterReload.records.length === 2 && afterReload.thoughts.some(thought => thought.text === '更新前保留的想法') && !afterReload.timer.session)

  await button(page, '设置').click()
  const beforePreview = await rawSnapshot(page)
  await button(page, '试听提示音').click()
  await page.getByText('已播放试听提示音。', { exact: true }).waitFor()
  check('Sound preview with sound off does not change preference, timer or data', !await page.getByRole('switch', { name: '到时提示音', exact: true }).isChecked() && await rawSnapshot(page) === beforePreview)

  // A newer-schema fallback must retain its only recovery action. Its unknown
  // data, including any future timer representation, stays byte-for-byte intact.
  const futureRaw = JSON.stringify({ ...afterReload, version: 999, futureTimer: { active: true, opaque: 'retain-me' } })
  await page.evaluate(raw => localStorage.setItem('whale-focus:snapshot', raw), futureRaw)
  await page.reload()
  await page.getByText('历史数据由更新版本保存，当前无法读取。请更新应用后查看。', { exact: true }).waitFor()
  await writeFile(workerPath, `${worker}\n// Newer-schema recovery verification ${Date.now()}\n`)
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update() })
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)
  await button(page, '更新并重载').waitFor()
  check('A newer-schema read-only fallback keeps explicit update available', await button(page, '更新并重载').isEnabled())
  await Promise.all([
    page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() }),
    button(page, '更新并重载').click(),
  ])
  await page.getByText('历史数据由更新版本保存，当前无法读取。请更新应用后查看。', { exact: true }).waitFor()
  check('Updating a newer-schema fallback preserves unknown raw data exactly', await rawSnapshot(page) === futureRaw)

  const blocked = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  await blocked.addInitScript(() => {
    class BlockedAudioContext {
      state = 'suspended'
      resume() { return Promise.reject(new DOMException('Injected audio restriction', 'NotAllowedError')) }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: BlockedAudioContext })
  })
  const blockedPage = await blocked.newPage()
  blockedPage.on('pageerror', error => errors.push(error.message))
  await blockedPage.goto(url)
  await button(blockedPage, '设置').click()
  const beforeBlocked = await rawSnapshot(blockedPage)
  await button(blockedPage, '试听提示音').click()
  await blockedPage.getByText('提示音未能播放，可以再试一次；计时照常可用。', { exact: true }).waitFor()
  check('Blocked preview reports its actual result without changing data', await rawSnapshot(blockedPage) === beforeBlocked && !await blockedPage.getByRole('switch', { name: '到时提示音', exact: true }).isChecked())
  check('No browser page errors', errors.length === 0)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors, realServiceWorkerUpdate: true }, null, 2))
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
