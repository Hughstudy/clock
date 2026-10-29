/** Optional production smoke test. Requires Playwright and a Chromium installation; see docs/verification/focus-records.md. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
let URL;
const KEY = 'whale-focus:snapshot';
const path = require('node:path');
const OUT = process.env.CLOCK_QA_OUTPUT_DIR || path.join(require('node:os').tmpdir(), 'clock-focus-qa');
fs.mkdirSync(OUT, {recursive:true});
const MIN = 60000;
const T0 = Date.UTC(2026,9,29,9);
const delay = ms => new Promise(r => setTimeout(r, ms));
async function poll(f, description) { for(let i=0;i<100;i++){ if(await f()) return; await delay(30); } throw Error('Timed out: '+description); }
async function snap(p){ return p.evaluate(k => JSON.parse(localStorage.getItem(k)),KEY); }
async function clock(p,t){ await p.clock.install({time:new Date(t-1000)}); await p.clock.pauseAt(new Date(t)); }
async function tap(p,name){ await p.getByRole('button',{name,exact:true}).click(); }
async function end(p){ await tap(p,'结束并记录'); await tap(p,'确认结束并记录'); }
async function settled(p){ await poll(async()=> (await p.locator('.save-state').textContent())==='进度已自动保存到此浏览器','saved state'); }
(async()=>{
 const http=require('node:http');
 const dist=path.resolve(__dirname,'../dist');
 const server=http.createServer((req,res)=>{
  const pathname=new globalThis.URL(req.url,'http://localhost').pathname;
  const relative=pathname.replace(/^\/clock\//,'') || 'index.html';
  const file=pathname.startsWith('/__qa-fonts/') && process.env.CLOCK_QA_FONT_DIR ? path.join(process.env.CLOCK_QA_FONT_DIR,pathname.slice('/__qa-fonts/'.length)) : path.join(dist,relative);
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
  try{const bytes=fs.readFileSync(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 URL=`http://127.0.0.1:${server.address().port}/clock/`;
 const browser=await chromium.launch({headless:true, ...(process.env.CLOCK_QA_CHROMIUM ? {executablePath:process.env.CLOCK_QA_CHROMIUM} : {}), args:['--no-sandbox', '--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});
 const errors=[]; context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});});
 if(process.env.CLOCK_QA_FONT_DIR) await context.addInitScript(()=>{addEventListener('DOMContentLoaded',()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/__qa-fonts/index.css';document.head.appendChild(link);});});
 const page=await context.newPage(); await clock(page,T0); await page.goto(URL); await settled(page);
 await tap(page,'开始专注'); await settled(page);
 await page.clock.fastForward(8*MIN); await tap(page,'暂停'); await settled(page);
 await page.reload(); await settled(page);
 assert.equal((await snap(page)).timer.session.status,'paused');
 await page.clock.fastForward(3*MIN); await tap(page,'继续'); await settled(page);
 await page.clock.fastForward(2*MIN); await end(page); await settled(page);
 let s=await snap(page); assert.equal(s.records.length,1); assert.equal(s.records[0].elapsedMs,10*MIN); assert.equal(s.participations.length,1); assert.equal(s.timer.completedFocusCount,0);
 await tap(page,'记录'); assert.match(await page.locator('.focus-history').textContent(),/10 分钟/);
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:OUT+'/focus-records.png',fullPage:true});
 await tap(page,'专注'); await tap(page,'先做 5 分钟'); await settled(page); await page.clock.fastForward(1000); await end(page); await settled(page);
 assert.equal((await snap(page)).records[1].elapsedMs,1000);
 // Abrupt page close: no unload handler is needed. Reopen past the saved deadline.
 await tap(page,'先做 5 分钟'); await settled(page); const abandonedId=(await snap(page)).timer.session.id; const deadline=(await snap(page)).timer.session.deadline; await page.close();
 const reopened=await context.newPage(); await clock(reopened,deadline+24*60*MIN); await reopened.goto(URL); await settled(reopened);
 s=await snap(reopened); assert.equal(s.records.length,3); assert.equal(s.records[2].sessionId,abandonedId); assert.equal(s.records[2].elapsedMs,5*MIN); assert.equal(s.timer.session,null); assert.equal(s.timer.completedFocusCount,1); assert.equal(await reopened.locator('.sr-only[aria-live]').textContent(),'');
 await reopened.reload(); await settled(reopened); assert.equal((await snap(reopened)).records.length,3);
 await tap(reopened,'回到专注'); await settled(reopened);
 // Two visible pages finish the same segment concurrently.
 await tap(reopened,'先做 5 分钟'); await settled(reopened); const shared=await snap(reopened);
 const other=await context.newPage(); await clock(other,shared.timer.session.startedAt+2000); await other.goto(URL); await settled(other);
 await tap(reopened,'结束并记录'); await tap(other,'结束并记录');
 // Hold the shared lock until both UI commands are queued, avoiding an automation
 // race where the first tab's saved result removes the second tab's button.
 await reopened.evaluate(()=>new Promise(ready=>{
  navigator.locks.request('whale-focus:snapshot',()=>new Promise(release=>{window.__releaseFocusLock=release;ready();}));
 }));
 await Promise.all([tap(reopened,'确认结束并记录'),tap(other,'确认结束并记录')]);
 await reopened.evaluate(()=>window.__releaseFocusLock());
 await settled(reopened); await settled(other);
 s=await snap(reopened); assert.equal(s.records.length,4); assert.equal(s.participations.length,4);
 // A write failure keeps the ending in memory and suppresses success; retry keeps its ID.
 await tap(reopened,'开始专注'); await settled(reopened); const failId=(await snap(reopened)).timer.session.id;
 await reopened.evaluate(()=>{ window.__originalSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){ if(k==='whale-focus:snapshot')throw new DOMException('simulated quota','QuotaExceededError'); return window.__originalSetItem.call(this,k,v); }; });
 await reopened.clock.fastForward(20000); await end(reopened);
 await poll(async()=> (await reopened.locator('.save-state').textContent()).includes('尚未保存'),'pending save');
 assert.notEqual(await reopened.locator('.sr-only[aria-live]').textContent(),'这一段已记录。可以休息，也可以稍后再来。');
 assert.equal((await snap(reopened)).records.length,4);
 await reopened.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem;}); await tap(reopened,'重试保存'); await settled(reopened);
 s=await snap(reopened); assert.equal(s.records.length,5); assert.equal(s.records[4].sessionId,failId); assert.equal(s.records[4].elapsedMs,20000);
 await reopened.reload(); await settled(reopened); assert.equal((await snap(reopened)).records.length,5);
 // Layout and keyboard checks at mobile widths and enlarged text.
 const layouts=[];
 for (const width of [320,375,430]) {
  await reopened.setViewportSize({width,height:900});
  assert(await reopened.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await tap(reopened,'开始专注'); await settled(reopened); await tap(reopened,'结束并记录');
  assert(await reopened.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await tap(reopened,'先不结束'); await tap(reopened,'暂停'); await settled(reopened);
  await reopened.getByRole('button',{name:'继续',exact:true}).focus(); await reopened.keyboard.press('Enter'); await settled(reopened);
  assert.equal((await snap(reopened)).timer.session.status,'running'); await end(reopened); await settled(reopened);
  layouts.push(width);
 }
 await reopened.setViewportSize({width:320,height:900}); await reopened.addStyleTag({content:'html { font-size: 200% !important; }'});
 assert(await reopened.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await reopened.locator('.digits').evaluate(el=>{const digit=el.getBoundingClientRect(), dial=el.closest('.dial').getBoundingClientRect();return digit.left>=dial.left && digit.right<=dial.right;}));
 await reopened.evaluate(()=>document.fonts.ready);
 await reopened.screenshot({path:OUT+'/focus-320-text200.png',fullPage:true});
 await tap(reopened,'休息一下'); await settled(reopened); assert.equal((await snap(reopened)).timer.phase,'shortBreak');
 await tap(reopened,'回到专注'); await settled(reopened);
 await reopened.addStyleTag({content:'html { font-size: 100% !important; }'});
 await reopened.setViewportSize({width:375,height:812}); await reopened.evaluate(()=>document.fonts.ready);
 await reopened.screenshot({path:OUT+'/focus-home.png',fullPage:true});
 const reduced=await reopened.locator('.whale').evaluate(el=>getComputedStyle(el).animationName); assert.equal(reduced,'none');
 assert.deepEqual(errors,[]);
 const result={browser:browser.version(),checks:['8+pause3+2=10','one-second manual end','reload paused','close and reopen after expiry: one record','reopen silent','two-tab end dedup','quota failure preserves pending end','manual retry then reload','mobile widths','200% text at 320px','keyboard resume','reduced motion','no console/page errors'],layouts,recordCount:(await snap(reopened)).records.length};
 fs.writeFileSync(OUT+'/focus-browser-results.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
 await browser.close(); server.close();
})().catch(e=>{console.error(e);process.exit(1);});
