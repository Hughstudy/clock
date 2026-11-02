import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CompanionSceneArt } from '../components/companion/CompanionSceneArt'
import type { CompanionScene } from '../contracts/presentation'
import { sampleScenePose, type ScenePoint, type ScenePoseInput } from './scene-pose'

/** Read the actual cubic path emitted by the production renderer, not contacts. */
function drawnArm(html:string,side:'left'|'right') {
  const d=html.match(new RegExp(`data-scene-hand="${side}" d="([^"]+)"`))?.[1]
  if(!d)throw new Error(`Missing ${side} hand path`)
  const n=(d.match(/-?\d+(?:\.\d+)?/g)??[]).map(Number)
  const outline:ScenePoint[]=[{x:n[0]!,y:n[1]!}]
  let start=outline[0]!
  for(let i=2;i<n.length;i+=6){
    const a={x:n[i]!,y:n[i+1]!},b={x:n[i+2]!,y:n[i+3]!},end={x:n[i+4]!,y:n[i+5]!}
    for(let j=1;j<=32;j++){
      const t=j/32,s=1-t
      outline.push({x:s**3*start.x+3*s*s*t*a.x+3*s*t*t*b.x+t**3*end.x,y:s**3*start.y+3*s*s*t*a.y+3*s*t*t*b.y+t**3*end.y})
    }
    start=end
  }
  return outline
}
function contains(poly:ScenePoint[],p:ScenePoint) {
  let inside=false
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i]!,b=poly[j]!
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside
  }
  return inside
}
function render(input:Omit<ScenePoseInput,'id'>) {
  const scene:CompanionScene={id:'F2',key:'plant',sessionId:'plant',phase:'focus',status:input.status??'running',completedProgress:input.progress,allowBeats:true,cue:null,ending:null}
  return renderToStaticMarkup(createElement(CompanionSceneArt,{scene,frame:sampleScenePose({...input,id:'F2'})}))
}
function ellipse(html:string,part:string) {
  const tag=html.slice(html.indexOf(`data-scene-part="${part}"`)).match(/<ellipse[^>]+>/)?.[0]
  if(!tag)throw new Error(`Missing ${part} ellipse`)
  const read=(name:string)=>Number(tag.match(new RegExp(` ${name}="([^"]+)"`))?.[1])
  return {x:read('cx'),y:read('cy'),rx:read('rx'),ry:read('ry')}
}
function checkSupport(html:string) {
  const left=drawnArm(html,'left'),right=drawnArm(html,'right'),rim=ellipse(html,'plant-pot'),table=ellipse(html,'table')
  // F2's body, arms and pot have the same parent scene scale and no lean.
  // If that layering changes, this assertion requires the test to account for it.
  expect(html).toContain('transform="rotate(0 162 198)" data-scene-part="arms"')
  expect(html).toContain('data-scene-part="plant-pot"><path')
  const root=left[0]!
  const lip=Array.from({length:91},(_,i)=>({x:rim.x+rim.rx*Math.cos(i*Math.PI/180),y:rim.y+rim.ry*Math.sin(i*Math.PI/180)}))
  // The visible distal hand, not its shoulder, must cover part of the near lip.
  const overlap=lip.filter(p=>Math.hypot(p.x-root.x,p.y-root.y)>15&&contains(left,p))
  expect(overlap.length).toBeGreaterThan(12)
  expect(html.indexOf('data-scene-part="arms"')).toBeGreaterThan(html.indexOf('data-scene-part="plant-pot"'))
  // The lowered right palm lies within the solid tabletop, not beside/under it.
  const bottom=right.reduce((a,b)=>a.y>b.y?a:b)
  expect(((bottom.x-table.x)/table.rx)**2+((bottom.y-table.y)/table.ry)**2).toBeLessThan(1)
  expect(bottom.y).toBeGreaterThan(table.y+3)
  expect(right[0]).toEqual({x:213,y:143})
  expect(root).toEqual({x:111,y:143})
}

describe('plant rendered hand and support geometry',()=>{
  it('keeps the actual palm on the drawn rim in running, paused, early and full endings, including static mode',()=>{
    for(const status of ['running','paused','ended'] as const)for(const progress of [0,.07,.4,.75,1])for(const staticOnly of [false,true])checkSupport(render({status,progress,staticOnly}))
  })
  it('preserves drawn support throughout the gesture and every interrupted ending sample',()=>{
    for(let i=0;i<=100;i++){
      checkSupport(render({progress:.75,actionKind:'beat',actionProgress:i/100}))
      for(const interrupted of [.2,.5,.75])checkSupport(render({status:'ended',progress:.75,actionKind:'ending',endingFromActionProgress:interrupted,actionProgress:i/100}))
    }
  })
})
