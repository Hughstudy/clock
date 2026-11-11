import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchChromium } from './lib/browser.mjs'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

// The source override accepts an archived checkout for scale-matched comparisons.
const source = path.resolve(process.env.ARM_REVIEW_SOURCE || '.')
const output = path.resolve(process.env.ARM_REVIEW_OUTPUT || '.preview/arm-poses')
await mkdir(output, { recursive: true })
const bundle = path.join(output, 'renderer')
await build({
  configFile: false, plugins: [react()], ssr: { noExternal: ['roughjs'] },
  build: {
    ssr: path.join(source, 'scripts/export-scene-storyboards.tsx'), outDir: bundle,
    emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'render.mjs' } },
  }, logLevel: 'warn',
})
const { renderStoryboardFrame } = await import(pathToFileURL(path.join(bundle, 'render.mjs')).href)
const drawingStyles = await readFile(path.join(source, 'src/styles/companion-scenes.css'), 'utf8')
const phases = {
  F1: [0, .08, .15, .21, .4, .59, .86, 1],
  F2: [0, .15, .3, .5, .715, .86, .95, 1],
  F3: [0, .12, .20, .32, .58, .82, .89, .96],
  F4: [0, .09, .15, .22, .25, .28, .34, 1],
  F5: [0, .052, .14, .204, .30, .40, .525, 1],
  F6: [0, .33, .61, .73, .86, .9, .94, 1],
  F7: [0, .14, .28, .4, .5, .6, .7, 1],
  F8: [0, .15, .30, .40, .60, .75, .90, 1],
  R1: [0, .15, .30, .40, .56, .75, .90, 1],
  R2: [0, .15, .30, .40, .60, .75, .90, 1],
  R3: [0, .25, .50, .72, .81, .90, .95, 1],
}
const actionSamples = new Set(['F2','R1','R3'])
function draw(id, fraction, index) {
  const gesture = actionSamples.has(id)
  // R3's last three images follow the cup onto the saucer during its ending.
  const ending = id === 'R3' && index >= 5
  const u = ending ? [0, .6, 1][index - 5] : fraction
  const kind = ending ? 'ending' : gesture ? 'beat' : 'idle'
  const rendered = renderStoryboardFrame(id, gesture ? .75 : fraction, u, kind, ending)
  const percent = Math.round((gesture ? u : fraction) * 100)
  const label = (ending ? 'Set-down' : gesture ? 'Gesture' : 'Progress') + ' · ' + percent + '%'
  return { label, html: '<svg width="320" height="240" viewBox="0 0 240 180">' + rendered + '</svg>' }
}
const style = `<style>${drawingStyles}
  *{box-sizing:border-box}body{margin:0;font:14px system-ui,sans-serif;color:#273c4d;background:#fffcf7}
  main{width:max-content;padding:12px}header{display:flex;align-items:baseline;gap:12px;margin:0 0 9px}h1{margin:0;font-size:18px}
  section{display:grid;grid-template-columns:repeat(4,277px);gap:5px}
  figure{background:white;border:1px solid #d5dcd9;border-radius:12px;overflow:hidden;margin:0}
  figcaption{padding:6px 9px}svg{display:block;width:100%;height:auto}
  .scene-rig *{animation:none!important;transition:none!important}
  .trace [data-scene-hand=left]{stroke:#d13062;stroke-width:2}
  .trace [data-scene-hand=right]{stroke:#087567;stroke-width:2}
  </style>`
let browser
try {
  browser=await launchChromium()
  const page=await browser.newPage({viewport:{width:1150,height:1600},deviceScaleFactor:1})
  for(const [id, positions] of Object.entries(phases)){
    const cells=positions.map((fraction,index)=>draw(id,fraction,index))
    for(const trace of [false,true]){
      const title=trace?'Arm outlines in the production scene · left in magenta, right in green':'Production scene'
      await page.setContent(style+'<main class="'+(trace?'trace':'')+'"><header><h1>'+id+'</h1>'+title+'</header><section>'+
        cells.map(cell=>'<figure><figcaption>'+cell.label+'</figcaption>'+cell.html+'</figure>').join('')+'</section></main>')
      if (!trace) {
        const attached = await page.locator('figure > svg').evaluateAll(nodes => nodes.map(svg => {
          const body = svg.querySelector('[data-part="body"] path')
          return [...svg.querySelectorAll('[data-scene-hand]')].map(hand => {
            const shoulder = hand.getPointAtLength(0).matrixTransform(hand.getScreenCTM())
            return body.isPointInFill(shoulder.matrixTransform(body.getScreenCTM().inverse()))
          })
        }))
        assert.ok(attached.every(pair => pair.length === 2 && pair.every(Boolean)),
          id + ' shoulder outside the painted body: ' + JSON.stringify(attached))
      }
      await page.locator('main').screenshot({path:path.join(output,id+(trace?'-outlines':'')+'.png')})
    }
  }
  const entries = Object.keys(phases).map(id =>
    '<article><a href="' + id + '.png"><img src="' + id + '.png" alt="Eight production poses for ' + id + '"></a>' +
    '<a href="' + id + '-outlines.png">' + id + ' · inspect arm outlines</a></article>')
  await writeFile(path.join(output, 'index.html'),
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Activity arm review</title><style>body{margin:16px;background:#fffcf7;color:#273c4d;font:16px system-ui}' +
    'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:16px}' +
    'article{min-width:0}img{max-width:100%;display:block}a{color:#195c7d}</style><h1>Activity arm review</h1><main>' +
    entries.join('') + '</main></html>')
  console.log('Rendered eight poses per activity with and without outline tracing in '+output)
} finally {
  await browser?.close()
}
