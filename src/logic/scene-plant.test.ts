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
  // Read the actual drawn wall, from the end of its top edge to its base.
  const pot=html.slice(html.indexOf('data-scene-part="plant-pot"'))
  const side=pot.match(/<path[^>]+ d="M[\d.]+ ([\d.]+) H([\d.]+) L([\d.]+) ([\d.]+)/)
  if(!side)throw new Error('Missing pot side wall')
  const topY=Number(side[1]),topX=Number(side[2]),baseX=Number(side[3]),baseY=Number(side[4])
  const wallX=(y:number)=>topX + (baseX-topX)*(y-topY)/(baseY-topY)
  const hands=[...left,...right]
  const wall=hands.filter(p=>p.y>=topY&&p.y<=baseY)
  expect(Math.min(...wall.map(p=>p.x-wallX(p.y)))).toBeGreaterThanOrEqual(-.001)
  const lip=hands.filter(p=>Math.abs(p.y-rim.y)<=rim.ry)
  const soilClearance=lip.map(p=>p.x-rim.x-rim.rx*Math.sqrt(1-((p.y-rim.y)/rim.ry)**2))
  expect(Math.min(...soilClearance)).toBeGreaterThan(1)
  const pad=left.filter(p=>p.y>rim.y+2*rim.ry&&p.y<=baseY)
  const contact=pad.reduce((a,b)=>Math.abs(a.x-wallX(a.y))<Math.abs(b.x-wallX(b.y))?a:b)
  expect(Math.abs(contact.x-wallX(contact.y))).toBeLessThan(.01)
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
  return contact
}

describe('plant rendered hand and support geometry',()=>{
  it('keeps the left palm on the outside wall and the hands off the soil in running, paused, early and full endings, including static mode',()=>{
    for(const status of ['running','paused','ended'] as const)for(const progress of [0,.07,.4,.75,1])for(const staticOnly of [false,true])checkSupport(render({status,progress,staticOnly}))
  })
  it('preserves drawn support throughout the gesture and every interrupted ending sample',()=>{
    for(let i=0;i<=100;i++){
      for(const actionKind of ['open','beat'] as const)checkSupport(render({progress:.75,actionKind,actionProgress:i/100}))
      for(const interrupted of [.2,.5,.75])checkSupport(render({status:'ended',progress:.75,actionKind:'ending',endingFromActionProgress:interrupted,actionProgress:i/100}))
    }
  })
  it('keeps the planting pose during touch and slides the pad along the wall during a beat',()=>{
    const idle=render({progress:.4})
    for(const touchKind of ['pat','squish','high-five'] as const){
      const touched=render({progress:.4,touchKind})
      checkSupport(touched)
      expect(drawnArm(touched,'left')).toEqual(drawnArm(idle,'left'))
    }
    const peak=render({progress:.4, actionKind:'beat', actionProgress:800/1120})
    expect(checkSupport(peak).y-checkSupport(idle).y).toBeCloseTo(3.6,1)
  })
  it('draws one long rounded limb from either shoulder to its resting pad across the gesture',()=>{
    for(const t of [0,.15,.4,800/1120,1])for(const side of ['left','right'] as const){
      const outline=drawnArm(render({progress:.4,actionKind:'beat',actionProgress:t}),side)
      const width=Math.max(...outline.map(p=>p.x))-Math.min(...outline.map(p=>p.x))
      const bottom=Math.max(...outline.map(p=>p.y))
      const shoulderY=outline[0]!.y
      expect(bottom-shoulderY).toBeGreaterThan(1.5*width)
      // Each horizontal section below the shoulder has one uninterrupted fill.
      for(let y=shoulderY+2.5;y<bottom-1;y+=2){
        const crossings=outline.slice(1).filter((b,i)=>(b.y>y)!==(outline[i]!.y>y))
        expect(crossings).toHaveLength(2)
      }
    }
  })
})
