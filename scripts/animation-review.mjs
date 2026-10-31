import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

const output = process.env.ANIMATION_REVIEW_OUTPUT || await mkdtemp(path.join(tmpdir(), 'clock-animation-review-'))
await mkdir(output, { recursive: true })
const server = await createServer({ configFile:false, root:path.resolve('preview/animation'), plugins:[react()], server:{host:'127.0.0.1',port:0} })
await server.listen()
const url = `http://127.0.0.1:${server.httpServer.address().port}`
const browser = await chromium.launch({headless:true,channel:process.env.SCENE_BROWSER_CHANNEL || 'chrome'})
const checks=[],errors=[]
const check=(label,condition)=>{assert.ok(condition,label);checks.push(label)}
const ids=['F1','F2','F3','F4','F5','F6','F7','F8','R1','R2','R3']
const page=await browser.newPage({viewport:{width:1200,height:1000}})
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
const svg=page.locator('.preview__phone .blue-companion')
async function range(locator,value){await locator.evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},value)}
const progress=value=>range(page.getByRole('slider',{name:/Completed progress/}),value*100)
const action=value=>range(page.getByRole('slider',{name:/Action position/}),value)
const choose=id=>page.getByLabel('Scene',{exact:true}).selectOption(id)
const contacts=()=>svg.evaluate(el=>Array.from(el.querySelectorAll('[data-contact-active="true"]')).every(node=>Math.hypot(Number(node.dataset.handX)-Number(node.dataset.propX),Number(node.dataset.handY)-Number(node.dataset.propY))<.01))
// Keep deterministic lifecycle regressions separate from the real frame-timing
// sample below. No production timer/accounting state is replaced by this clock.
async function frozenPreview(run){
  const fixture=await browser.newPage({viewport:{width:1200,height:1000}})
  fixture.on('pageerror',e=>errors.push(e.message))
  fixture.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  try{
    await fixture.clock.install({time:new Date('2026-10-31T00:00:00Z')})
    await fixture.goto(url)
    await fixture.getByLabel('Scene',{exact:true}).waitFor()
    await fixture.clock.pauseAt(new Date('2026-10-31T00:01:00Z'))
    await run(fixture,fixture.locator('.preview__phone .blue-companion'))
  }finally{await fixture.close()}
}
const cupSupport=el=>({
  cup:el.querySelector('[data-scene-part="cup"]').getAttribute('transform'),
  left:el.querySelector('[data-scene-hand="left"]').getAttribute('d'),
  right:el.querySelector('[data-scene-hand="right"]').getAttribute('d'),
})
const sameCupSupport=(a,b)=>a.cup===b.cup&&a.left===b.left&&a.right===b.right
const cupPosition=transform=>transform.match(/translate\(([-\d.e]+) ([-\d.e]+)\)/).slice(1).map(Number)
try {
  await page.goto(url)
  await page.getByLabel('Inspect exact poses').check()
  for(const id of ids){
    await choose(id)
    await page.getByLabel('Sequence',{exact:true}).selectOption(id.startsWith('R')?'beat':'idle')
    for(const scheme of ['light','dark']){
      await page.emulateMedia({colorScheme:scheme})
      for(const width of [320,375,430]){
        await page.setViewportSize({width,height:900})
        for(const p of [0,.25,.5,.75,1]){
          await progress(p);await action(p)
          check(`${id} ${scheme} ${width} ${p}: finite supported geometry`,await svg.evaluate(el=>!(/NaN|Infinity/).test(el.innerHTML))&&await contacts())
        }
        check(`${id} ${scheme} ${width}: no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
      }
    }
    await page.setViewportSize({width:1200,height:1000});await page.emulateMedia({colorScheme:'light'})
    await page.getByRole('region',{name:'Selected activity contact sequence'}).screenshot({path:path.join(output,`${id}-contacts.png`)})
  }
  // Retained scene nodes and independently running ambient loops.
  await choose('F4');await page.getByLabel('Inspect exact poses').uncheck();await progress(.4)
  await page.locator('.preview__phone').scrollIntoViewIfNeeded()
  await page.waitForTimeout(2800)
  await svg.evaluate(el=>{globalThis.__reviewNodes={rig:el.querySelector('.scene-rig'),cup:el.querySelector('[data-scene-part="cup"]'),hand:el.querySelector('[data-scene-hand="left"]'),breath:el.getAnimations({subtree:true}).find(a=>a instanceof CSSAnimation&&a.animationName==='scene-rig-breath')}})
  await page.getByRole('button',{name:'New entrance cue',exact:true}).click()
  await page.waitForTimeout(80)
  check('Cue retains scene, cup, hand and ambient animation identity',await svg.evaluate(el=>{const r=globalThis.__reviewNodes;return r.rig===el.querySelector('.scene-rig')&&r.cup===el.querySelector('[data-scene-part="cup"]')&&r.hand===el.querySelector('[data-scene-hand="left"]')&&el.getAnimations({subtree:true}).includes(r.breath)&&r.breath.playState==='running'}))
  await progress(.75);await page.waitForTimeout(300)
  await page.getByLabel('Scene state',{exact:true}).selectOption('paused')
  const held=await svg.locator('[data-scene-hand="left"]').getAttribute('d')
  await page.waitForTimeout(180)
  check('Pause freezes the exact supported hand configuration',held===await svg.locator('[data-scene-hand="left"]').getAttribute('d')&&await contacts())
  check('Pause retains ambient loops without running them',await svg.evaluate(el=>el.getAnimations({subtree:true}).every(a=>a.playState!=='running')))
  await page.getByLabel('Scene state',{exact:true}).selectOption('loop');await page.waitForTimeout(2800)
  check('Resume settles without replaying an entrance',await svg.getAttribute('data-scene-phase')==='idle'&&await contacts())
  await page.getByLabel('Thought editor needs attention').check()
  check('Attention suppression stops local and ambient movement',await svg.getAttribute('data-scene-motion')==='false'&&await svg.evaluate(el=>el.getAnimations({subtree:true}).every(a=>a.playState!=='running')))
  await page.getByLabel('Thought editor needs attention').uncheck()
  await choose('R3');await page.getByLabel('Scene state',{exact:true}).selectOption('loop')
  await page.getByRole('button',{name:'Hold head pat',exact:true}).click();await page.waitForTimeout(100)
  check('Touch preserves both cup support contacts',await contacts()&&await svg.locator('[data-scene-part="cup"]').getAttribute('data-held')==='true')
  await page.getByRole('button',{name:'Settle',exact:true}).click()
  await page.emulateMedia({reducedMotion:'reduce'})
  check('Reduced motion retains the scene with no CSS animations',await svg.locator('.scene-rig').count()===1&&await svg.evaluate(el=>el.getAnimations({subtree:true}).length===0))
  await page.emulateMedia({reducedMotion:'no-preference'})
  for(const paused of [false,true])await frozenPreview(async(fixture,character)=>{
    const label=paused?'Paused mid-sip ending':'Running mid-sip ending'
    await fixture.getByLabel('Scene',{exact:true}).selectOption('R3')
    await fixture.clock.runFor(32)
    const resting=await character.evaluate(cupSupport)
    // The next sparse quiet beat begins a genuine live sip. fastForward fires
    // its timer once, then runFor samples the middle of its finite gesture.
    await fixture.clock.fastForward(90_000)
    await fixture.clock.runFor(560)
    const sipping=await character.evaluate(cupSupport)
    check(`${label}: fixture reaches a lifted sip`,await character.getAttribute('data-scene-phase')==='beat'&&cupPosition(sipping.cup)[1]<cupPosition(resting.cup)[1]-8)
    if(paused){
      await fixture.getByLabel('Scene state',{exact:true}).selectOption('paused')
      await fixture.clock.runFor(180)
      check(`${label}: pause retains the lifted cup and both hands`,sameCupSupport(sipping,await character.evaluate(cupSupport)))
    }
    const before=await character.evaluate(cupSupport)
    await fixture.getByRole('button',{name:'New ending cue',exact:true}).click()
    check(`${label}: ending starts from the current cup and hands`,sameCupSupport(before,await character.evaluate(cupSupport)))
    await fixture.clock.runFor(800)
    const carrying=await character.evaluate(cupSupport)
    check(`${label}: cup travels toward its side table with a handle grip`,cupPosition(carrying.cup)[0]>cupPosition(before.cup)[0]+10&&await character.locator('[data-scene-contact="cup-handle"][data-contact-active="true"]').count()===1)
    await fixture.clock.runFor(1000)
    check(`${label}: cup rests on the saucer before the hand releases`,await character.evaluate(el=>{
      const cup=el.querySelector('[data-scene-part="cup"]')
      const position=cup.getAttribute('transform').match(/translate\(([-\d.e]+) ([-\d.e]+)\)/).slice(1).map(Number)
      const saucer=el.querySelector('[data-scene-part="side-table"] ellipse.scene-draw-paper')
      return cup.dataset.held==='false'&&Math.abs(position[0]-Number(saucer.getAttribute('cx')))<.01&&Math.abs(position[1]-Number(saucer.getAttribute('cy')))<.01
    }))
  })
  await frozenPreview(async(fixture,character)=>{
    await fixture.getByLabel('Scene',{exact:true}).selectOption('F4')
    await range(fixture.getByRole('slider',{name:/Completed progress/}),20)
    await fixture.clock.runFor(3000)
    await fixture.evaluate(()=>{
      globalThis.__reviewHidden=true
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>globalThis.__reviewHidden})
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await fixture.clock.runFor(3000)
    // There is deliberately no hidden host update. Visibility and main's fresh
    // fraction arrive together, as they do during a suspended-page recovery.
    await fixture.evaluate(()=>{
      globalThis.__reviewHidden=false
      document.dispatchEvent(new Event('visibilitychange'))
      const input=Array.from(document.querySelectorAll('input[type="range"]')).find(el=>el.max==='100')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'80')
      input.dispatchEvent(new Event('input',{bubbles:true}))
      input.dispatchEvent(new Event('change',{bubbles:true}))
    })
    check('Visibility recovery settles the first fresh host fraction immediately',Number(await character.getAttribute('data-scene-activity-progress'))===.75)
    const settled=await character.evaluate(cupSupport)
    await fixture.clock.runFor(320)
    check('Visibility recovery does not replay missed handling',Number(await character.getAttribute('data-scene-activity-progress'))===.75&&await character.getAttribute('data-scene-phase')==='idle'&&sameCupSupport(settled,await character.evaluate(cupSupport)))
  })
  await choose('R2');await page.getByLabel('Scene state',{exact:true}).selectOption('loop')
  check('Cloud watching keeps both eyes open',await svg.locator('[data-part="eyeLeft"], [data-part="eyeRight"]').count()===2&&await svg.locator('[data-part="eyesResting"]').count()===0)
  check('Cloud watching has a running, bounded gaze movement',await svg.evaluate(el=>{
    const gaze=el.querySelector('.scene-rig-gaze')
    const watch=gaze.getAnimations().find(a=>a instanceof CSSAnimation&&a.animationName==='scene-rig-watch')
    if(!watch||watch.playState!=='running')return false
    const previous=watch.currentTime
    watch.currentTime=0;const start=parseFloat(getComputedStyle(gaze).translate)||0
    watch.currentTime=8000;const peak=parseFloat(getComputedStyle(gaze).translate)||0
    watch.currentTime=previous
    return peak-start>0&&peak-start<=2.01
  }))
  await page.emulateMedia({reducedMotion:'reduce'})
  check('Reduced motion stops cloud-watching gaze while retaining open eyes',await svg.evaluate(el=>el.querySelectorAll('[data-part="eyeLeft"], [data-part="eyeRight"]').length===2&&el.querySelector('.scene-rig-gaze').getAnimations().length===0))
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.setViewportSize({width:375,height:900});await page.getByLabel('200% scene text').check()
  check('200% preview text remains in the viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.getByLabel('200% scene text').uncheck()
  await page.getByRole('button',{name:'Say hello to the blue companion',exact:true}).focus()
  check('Native keyboard focus remains on the fixed target',await page.getByRole('button',{name:'Say hello to the blue companion',exact:true}).evaluate(el=>el===document.activeElement))
  // Real frame timing, with no virtual clock. Report separately from device QA.
  await choose('F4');await page.getByLabel('Scene state',{exact:true}).selectOption('loop')
  await progress(.4);await page.waitForTimeout(2800);await progress(.75)
  const timing=await page.evaluate(()=>new Promise(resolve=>{const deltas=[];let previous=null,start=null;const step=now=>{start??=now;if(previous!==null)deltas.push(now-previous);previous=now;if(now-start<5000)requestAnimationFrame(step);else{deltas.sort((a,b)=>a-b);resolve({frames:deltas.length,p50Ms:deltas[Math.floor(deltas.length*.5)],p95Ms:deltas[Math.floor(deltas.length*.95)],maxMs:deltas.at(-1),over50Ms:deltas.filter(x=>x>50).length})}};requestAnimationFrame(step)}))
  check('No runtime or console errors',errors.length===0)
  await writeFile(path.join(output,'report.json'),JSON.stringify({browser:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent),checks,timing,errors,output},null,2))
  console.log(JSON.stringify({checks:checks.length,timing,output}))
}finally{await browser.close();await server.close()}
