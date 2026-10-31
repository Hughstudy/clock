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
 ['tea-pour','F4','Tea · grasp, pour and return',[.4,.58,.68,.75],['Supported kettle','Grasp the top handle','Pour into the same cup','Return to the trivet']],
 ['tea-cup','F4','Tea · supported cup lift',[.8,.86,.93,1],['Reach the cup handle','Support the base','Lift the same cup','Settle close to the body']],
 ['food-serving','F1','Food · prepare three dishes',[0,.2,.5,.8,1],['Ingredients on the table','Prepare the vegetables','Plate the rice','Finish the soup','Three dishes ready']],
 ['book-page','F3','Book · turn, mark and close',[.1,.2,.32,.58,1],['Reach the page corner','Guide a single page','Let the page settle','Place the ribbon','Close on the table']],
 ['boat-fold','F6','Boat · fold and lower',[0,.3,.6,.82,.9,1],['Dry paper beside the tray','Press the crease','Open the hull','Lift with support','Lower into water','Release the boat']],
 ['wand-turn','F5','Bubbles · dip, turn and blow',[0,.08,.14,.2,.28,.4],['Dip the ring','Lift clear of the jar','Turn the rigid wand','Settle the grip','Blow through the ring','Let bubbles drift']],
 ['block-place','F7','Blocks · pickup and placement',[.12,.22,.32,.4],['Grasp a nearby block','Carry with support','Guide onto the base','Release the block']],
 ['drink-sip','R3','Warm drink · sip and set down',[0,.22,.5,.8,.65,1],['Hold the cup close','Blow gently','Tilt toward the mouth','Return to a comfortable hold','Lower onto the table','Release the resting cup']],
]
const sequences=definitions.map(([id,sceneId,title,positions,labels])=>({id,title,frames:positions.map((p,i)=>{const rest=sceneId==='R3',ended=rest&&i>=4,kind=rest?(ended?'ending':'beat'):'idle';return {label:labels[i],caption:rest?(ended?'Supported closing action':'Relaxed action cycle'):`Scene pose ${Math.round(p*100)}%`,sample:{progress:rest?0:p,actionKind:kind,actionProgress:rest?p:0,status:ended?'ended':'running'},svg:draw(sceneId,rest?0:p,kind,rest?p:0,ended)}})}))
await mkdir(path.join(out,'scene-contact-storyboards'),{recursive:true})
for(const sequence of sequences)await writeFile(path.join(out,'scene-contact-storyboards',sequence.id+'.svg'),sheet(sequence.title,'Contact and continuity samples from the production pose sampler.',sequence.frames,3))
await writeFile(path.join(out,'scene-contact-storyboards.json'),JSON.stringify({version:2,viewBox:'0 0 320 240',styles,sequences},null,2)+'\n')
console.log(`Exported ${scenes.length} production scene sheets and ${sequences.length} contact sheets (${scenes.length*4+sequences.reduce((n,s)=>n+s.frames.length,0)} frames).`)
