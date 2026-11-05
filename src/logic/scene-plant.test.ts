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
  // The right side of the drawn lip is also the outermost edge of the pot.
  // A palm centre at the rim can still leave half a hand inside the soil.
  const east=rim.x+rim.rx
  expect(Math.min(...left.map(p=>p.x),...right.map(p=>p.x))).toBeGreaterThanOrEqual(east-.001)
  expect(Math.min(...left.map(p=>Math.hypot(p.x-east,p.y-rim.y)))).toBeLessThan(.01)
  expect(html.indexOf('data-scene-part="arms"')).toBeGreaterThan(html.indexOf('data-scene-part="plant-pot"'))
  // The moved pot's footprint still fits within the drawn tabletop.
  const floor=ellipse(html,'plant')
  const footprint=Array.from({length:36},(_,i)=>{
    const a=i*2*Math.PI/36
    const x=floor.x+floor.rx*Math.cos(a),y=floor.y+floor.ry*Math.sin(a)
    return ((x-table.x)/table.rx)**2+((y-table.y)/table.ry)**2
  })
  expect(Math.max(...footprint)).toBeLessThan(1)
  // The lowered right palm lies within the solid tabletop, not beside/under it.
  const bottom=right.reduce((a,b)=>a.y>b.y?a:b)
  expect(((bottom.x-table.x)/table.rx)**2+((bottom.y-table.y)/table.ry)**2).toBeLessThan(1)
  expect(bottom.y).toBeGreaterThan(table.y+3)
  expect(right[0]).toEqual({x:213,y:143})
  expect(left[0]).toEqual({x:111,y:143})
}

describe('plant rendered hand and support geometry',()=>{
  it('keeps both hands outside the pot with the left palm touching the lip in running, paused, early and full endings, including static mode',()=>{
    for(const status of ['running','paused','ended'] as const)for(const progress of [0,.07,.4,.75,1])for(const staticOnly of [false,true])checkSupport(render({status,progress,staticOnly}))
  })
  it('preserves drawn support throughout the gesture and every interrupted ending sample',()=>{
    for(let i=0;i<=100;i++){
      for(const actionKind of ['open','beat'] as const)checkSupport(render({progress:.75,actionKind,actionProgress:i/100}))
      for(const interrupted of [.2,.5,.75])checkSupport(render({status:'ended',progress:.75,actionKind:'ending',endingFromActionProgress:interrupted,actionProgress:i/100}))
    }
  })
  it('keeps the planting grip during touch, while its elbow can flex during a beat',()=>{
    const idle=render({progress:.4})
    for(const touchKind of ['pat','squish','high-five'] as const){
      const touched=render({progress:.4,touchKind})
      checkSupport(touched)
      expect(drawnArm(touched,'left')).toEqual(drawnArm(idle,'left'))
    }
    const peak=render({progress:.4, actionKind:'beat', actionProgress:800/1120})
    const restingOutline=drawnArm(idle,'left')
    const displacement=drawnArm(peak,'left').map((p,i)=>Math.hypot(p.x-restingOutline[i]!.x,p.y-restingOutline[i]!.y))
    expect(Math.max(...displacement)).toBeGreaterThan(2)
  })
})
