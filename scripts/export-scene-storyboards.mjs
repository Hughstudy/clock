import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

// Design sheets and the application now share the very same pose geometry.
const root = process.cwd()
const out = path.join(root, 'docs/plans/assets')
const compiled = path.join(root, '.preview/storyboard-export')
await build({ configFile: false, plugins: [react()], ssr: { noExternal: ['roughjs'] }, build: { ssr: path.join(root, 'scripts/export-scene-storyboards.tsx'), outDir: compiled, emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'render.mjs' } } }, logLevel: 'warn' })
const { renderStoryboardFrame } = await import(pathToFileURL(path.join(compiled, 'render.mjs')).href)
const spec = JSON.parse(await readFile(path.join(out, 'scene-storyboard-spec.json'), 'utf8'))
const styles = (await readFile(path.join(root, 'src/styles/companion-scenes.css'), 'utf8')) + '\n.scene-rig * {animation:none!important;transition:none!important}'
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const draw = (id,p,kind='idle',a=0,ended=false) => `<g transform="scale(1.3333333333333333)">${renderStoryboardFrame(id,p,a,kind,ended)}</g>`
function sheet(title, description, frames, columns) {
  const rows = Math.ceil(frames.length / columns), width = columns*320, height = 70+rows*288
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${escape(title)}</title><desc id="desc">${escape(description)} Production renderer geometry; static samples do not establish motion performance.</desc><style>${styles}text{fill:#204b72;font-family:system-ui,sans-serif;}</style><rect width="${width}" height="${height}" fill="#f7fbff"/><text x="18" y="28" font-size="21" font-weight="500">${escape(title)}</text><text x="18" y="51" font-size="14">Production keyframes · shared hand and prop geometry</text>`
  frames.forEach((f,i) => { const x=i%columns*320,y=65+Math.floor(i/columns)*288;svg+=`<svg x="${x}" y="${y}" width="320" height="240" viewBox="0 0 320 240">${f.svg}</svg><text x="${x+18}" y="${y+259}" font-size="15" font-weight="500">${escape(f.label)}</text><text x="${x+18}" y="${y+279}" font-size="13">${escape(f.caption??'')}</text>` })
  return svg+'</svg>\n'
}
const scenes = spec.scenes.map(scene => ({ ...scene, frames:scene.frames.map((frame,i) => ({...frame,svg:draw(scene.id,[0,.4,.75,1][i],scene.kind==='rest'?'beat':'idle',scene.kind==='rest'?[0,.25,.5,1][i]:0)})) }))
for(const scene of scenes) {
  const svg=sheet(`${scene.id} · ${scene.title}`,scene.support,scene.frames,4)
  await writeFile(path.join(out,'scene-storyboards',scene.slug+'.svg'),svg)
  if(scene.id==='F4')await writeFile(path.join(out,'tea-progression-storyboard.svg'),svg)
}
await writeFile(path.join(out,'scene-storyboards.json'),JSON.stringify({version:2,viewBox:'0 0 320 240',styles,scenes},null,2)+'\n')
const definitions = [
 ['tea-pour','F4','Tea · hold, pour and return',[.03,.1,.15,.22],['Supported kettle','Lift by the handle','Pour into the same cup','Return to the trivet']],
 ['tea-cup','F4','Tea · supported cup lift',[.27,.32,.37,.45],['Take the cup by its near side','Slip the palm under','Lift the same cup','Settle close to the body']],
 ['food-serving','F1','Soup · tip each bowl at the rim, then stir',[0,.08,.15,.21,.4,.59,.75,.86,1],['Bowls beside the pot, below the hands','Hand on the bowl\'s far rim','Bowl brought to the pot','Tipped: the pieces fall in','Bowl back in its place','Dumplings tipped in','Both bowls empty','Stirring in circles','Soup is ready']],
 ['book-page','F3','Book · turn, mark and close',[.1,.2,.32,.58,.82,.885,.945,1],['Reach the page corner','Guide a single page','Let the page settle','Place the ribbon','Lift the cover edge','Guide the cover together','Lower onto the page stack','Release the closed book']],
 ['boat-fold','F6','Boat · fold and set afloat',[0,.3,.6,.86,.92,1],['Dry paper beside the tray','Press the crease','Open the hull','Lift with support','Set the bow on the water','The boat glides clear']],
 ['wand-turn','F5','Bubbles · reach, blow and put away',[0,.052,.14,.204,.30,.4],['Wand resting in the jar','Take the handle','Fold the forearm inward','Blow through the loop','Lower the wand','Rest the hand as the bubble drifts']],
 ['block-place','F7','Blocks · nudge the stack, then top the tower',[0,.14,.28,.4,.5,.6,.7,1],['Blocks clear of both arms','Palm beside the stack','Nudge it to the base','Rest','Support the flag block','Carry it across','Set it on the base','Tower, step and flag']],
 ['drink-sip','R3','Warm drink · sip and set down',[0,.22,.5,.8,.65,1],['Hold the cup close','Blow gently','Tilt toward the mouth','Return to a comfortable hold','Lower onto the table','Release the resting cup']],
]
const sequences=definitions.map(([id,sceneId,title,positions,labels])=>({id,title,frames:positions.map((p,i)=>{const rest=sceneId==='R3',ended=rest&&i>=4,kind=rest?(ended?'ending':'beat'):'idle';return {label:labels[i],caption:rest?(ended?'Supported closing action':'Relaxed action cycle'):`Scene pose ${Math.round(p*100)}%`,sample:{progress:rest?0:p,actionKind:kind,actionProgress:rest?p:0,status:ended?'ended':'running'},svg:draw(sceneId,rest?0:p,kind,rest?p:0,ended)}})}))
await mkdir(path.join(out,'scene-contact-storyboards'),{recursive:true})
for(const sequence of sequences)await writeFile(path.join(out,'scene-contact-storyboards',sequence.id+'.svg'),sheet(sequence.title,'Contact and continuity samples from the production pose sampler.',sequence.frames,3))
await writeFile(path.join(out,'scene-contact-storyboards.json'),JSON.stringify({version:2,viewBox:'0 0 320 240',styles,sequences},null,2)+'\n')
console.log(`Exported ${scenes.length} production scene sheets and ${sequences.length} contact sheets (${scenes.length*4+sequences.reduce((n,s)=>n+s.frames.length,0)} frames).`)
