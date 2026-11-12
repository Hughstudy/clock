import assert from 'node:assert/strict'
import path from 'node:path'
import { build, preview } from 'vite'
import { webkit } from 'playwright'
import { launchChromium } from './lib/browser.mjs'

const directory = path.resolve('.preview/records-book-build')
process.env.BASE_PATH = '/clock/'
await build({ build:{outDir:directory}, logLevel:'warn' })
const app = await preview({build:{outDir:directory},preview:{host:'127.0.0.1',port:0}})
const url = 'http://127.0.0.1:'+app.httpServer.address().port+'/clock/'
const snapshot = 'whale-focus:snapshot'
const browsers = process.env.RECORDS_WEBKIT === '1' ? [launchChromium, () => webkit.launch()] : [launchChromium]
try {
  for (const launch of browsers) {
    const browser = await launch()
    try {
      const page = await browser.newPage({viewport:{width:375,height:812},hasTouch:true,isMobile:true,locale:'zh-CN',timezoneId:'Asia/Singapore'})
      const errors = []
      page.on('pageerror', error=>errors.push(error.message))
      page.on('console', message=>{if(message.type()==='error')errors.push(message.text())})
      page.setDefaultTimeout(5000)
      const press = name=>page.getByRole('button',{name,exact:true}).click()
      const book = page.locator('#rj-leaf > [data-leaves]')
      const tab = key=>page.locator('[role="tab"][data-section="'+key+'"]')
      const turn = (dir,kind)=>page.locator('.bm-transition[data-direction="'+dir+'"][data-turn="'+kind+'"]')
      await page.goto(url)
      await press('记录')
      await page.locator('.bm-cover:not([hidden])').waitFor()
      assert.equal(await page.getByText('记录索引',{exact:true}).count(),0)
      await tab('room').click()
      assert.equal(await book.locator('[data-jl-source]').count(),0)
      await press('专注')
      await press('记下想法')
      const note = '晚些去找一本蓝色的书。'
      await page.getByRole('textbox').fill(note)
      await press('保存想法')
      await page.locator('dialog:modal').waitFor({state:'hidden'})
      await press('给我一句鼓励')
      await press('收藏这句')
      await page.getByRole('button',{name:'取消收藏这句',exact:true}).waitFor()
      await press('给我一句鼓励')
      await press('开始专注')
      await page.waitForFunction(key=>JSON.parse(localStorage[key])?.timer.session,snapshot)
      await press('结束专注')
      await press('确认结束')
      await page.waitForFunction(key=>JSON.parse(localStorage[key]).records.length===1,snapshot)
      await press('记录')
      await tab('room').click()
      const stamp=book.locator('[data-jl-source]')
      await stamp.waitFor()
      const scroll = () => book.locator('.jl-body').evaluate(el=>el.scrollTop)
      await stamp.scrollIntoViewIfNeeded()
      const origin=await scroll()
      await stamp.click()
      await turn('forward','leaf').waitFor()
      assert.equal(await tab('room').getAttribute('aria-selected'),'true')
      await book.locator('[data-jl-source-detail]').waitFor()
      assert.equal(await page.locator('dialog:modal').count(),0)
      await book.locator('[data-jl-back]').click()
      await turn('back','leaf').waitFor()
      assert(await stamp.evaluate(el=>el===document.activeElement))
      assert.equal(await scroll(),origin)
      await tab('thoughts').click()
      await book.locator('[data-jl-note]').click()
      await turn('forward','leaf').waitFor()
      assert((await book.locator('[data-jl-detail="note"]').innerText()).includes(note))
      await tab('favorites').click()
      await book.locator('[data-jl-quote-detail]').click()
      await book.locator('[data-jl-detail="quote"]').waitFor()
      await page.keyboard.press('Escape')
      await book.locator('[data-jl-letter]').click()
      await book.locator('[data-jl-detail="letter"]').waitFor()
      await page.emulateMedia({reducedMotion:'reduce'})
      await book.locator('[data-jl-back]').click()
      assert.equal(await page.locator('.bm-transition').count(),0)
      for (const width of [320,375,430]) {
        await page.setViewportSize({width,height:700})
        await page.addStyleTag({content:'html{font-size:200% !important}'})
        await tab('room').click()
        await stamp.click()
        await book.locator('[data-jl-source-detail]').waitFor()
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
        await page.keyboard.press('Escape')
        assert.equal(await page.locator('dialog:modal').count(),0)
        assert.equal(await tab('room').getAttribute('aria-selected'),'true')
      }
      assert.deepEqual(errors,[])
      console.log(browser.browserType().name(),browser.version(),'passed cover, chapter bookmarks, real saved item, source-preserving forward/back, focus, large text and reduced motion')
    } finally { await browser.close() }
  }
} finally { await new Promise(done=>app.httpServer.close(done)) }
