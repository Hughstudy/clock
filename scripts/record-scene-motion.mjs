import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

const output=process.env.ANIMATION_VIDEO_OUTPUT||await mkdtemp(path.join(tmpdir(),'clock-motion-video-'))
await mkdir(output,{recursive:true})
const server=await createServer({configFile:false,root:path.resolve('preview/animation'),plugins:[react()],server:{host:'127.0.0.1',port:0}});await server.listen()
const browser=await chromium.launch({headless:true,channel:process.env.SCENE_BROWSER_CHANNEL||'chrome'})
const url=`http://127.0.0.1:${server.httpServer.address().port}`
const files=[]
try{
 for(const id of ['F4','F3','F6']){
  const context=await browser.newContext({viewport:{width:640,height:500},recordVideo:{dir:output,size:{width:640,height:500}}})
  const page=await context.newPage();await page.goto(url)
  await page.getByLabel('Scene',{exact:true}).selectOption(id)
  const range=async(label,value)=>page.locator('input[type=range]').first().evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},value)
  await range('Completed progress',0)
  await page.addStyleTag({content:'.preview{padding:0}.preview__header,.preview__controls,.preview__poses,.preview__checks,.preview__phone>p,.preview__invite{display:none!important}.preview__workspace{display:block}.preview__canvas{padding:32px;background:#f7fbff;border-radius:0}.preview__phone{width:540px!important;padding:0;border:0;box-shadow:none;background:transparent}.preview__phone .companion-feedback__greeting{padding:0}.preview__phone .companion-feedback__character{width:480px;max-width:100%}.preview__phone .blue-companion{width:100%}'})
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(350)
  // Real production playback: each achieved landmark triggers a 2.6 s action.
  for(const value of [.4,.75,1]){await range('Completed progress',value*100);await page.waitForTimeout(3000)}
  await page.screenshot({path:path.join(output,`${id}-settled.png`)})
  // Slow inspection uses exactly the same sampler; never a second timer model.
  await page.locator('label').filter({hasText:'Inspect exact poses'}).locator('input').evaluate(el=>el.click())
  await page.locator('select[aria-label="Playback speed"]').evaluate(el=>{el.value='0.25';el.dispatchEvent(new Event('change',{bubbles:true}))})
  await range('Completed progress',id==='F4'?55:id==='F3'?10:78)
  await page.locator('button').filter({hasText:/^Play sequence$/}).evaluate(el=>el.click())
  // Play sequence begins at zero, so hold then choose the critical range.
  await page.locator('button').filter({hasText:/^Hold this pose$/}).evaluate(el=>el.click())
  const start=id==='F4'?.55:id==='F3'?.1:.78,end=id==='F4'?.98:id==='F3'?.4:1
  for(let i=0;i<=120;i++){await range('Completed progress',(start+(end-start)*i/120)*100);await page.waitForTimeout(45)}
  const video=page.video();await context.close();const file=path.join(output,`${id}-normal-and-slow.webm`);await video.saveAs(file);files.push(file);console.log(`Recorded ${id}: ${file}`)
 }
 await writeFile(path.join(output,'recordings.json'),JSON.stringify({browser:browser.version(),normalHandlingMs:2600,slowInspection:'120 sampled positions over about 5.4 seconds',files},null,2))
}finally{await browser.close();await server.close()}
