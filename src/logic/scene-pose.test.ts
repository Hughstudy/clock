import { describe, expect, it } from 'vitest'
import { BLOCK_HEIGHT, BUBBLE_WAND, sampleScenePose, sceneArmPath, simpleGesturePulse, SCENE_CUP_BASE, SCENE_CUP_HANDLE, transformScenePoint, type SceneArm, type ScenePoint } from './scene-pose'
import { achievedSceneLandmark } from './scene-playback'
import type { SceneId } from './types'
const ids:SceneId[]=['F1','F2','F3','F4','F5','F6','F7','F8','R1','R2','R3']
const distance=(a:ScenePoint,b:ScenePoint)=>Math.hypot(a.x-b.x,a.y-b.y)
function sampledOutline(arm:SceneArm){
  const p=arm.points,outline:ScenePoint[]=[];let x=p[0]??0,y=p[1]??0
  outline.push({x,y})
  for(let i=2;i<p.length;i+=6){const x1=p[i]??x,y1=p[i+1]??y,x2=p[i+2]??x,y2=p[i+3]??y,x3=p[i+4]??x,y3=p[i+5]??y
    for(let j=1;j<=12;j++){const t=j/12,s=1-t;outline.push({x:s*s*s*x+3*s*s*t*x1+3*s*t*t*x2+t*t*t*x3,y:s*s*s*y+3*s*s*t*y1+3*s*t*t*y2+t*t*t*y3})}x=x3;y=y3
  }
  return outline
}
function outlineArea(arm:SceneArm){
  const outline = sampledOutline(arm)
  return Math.abs(outline.reduce((sum,a,i)=>{const b=outline[(i+1)%outline.length]!;return sum+a.x*b.y-b.x*a.y},0))/2
}
function distanceToOutline(point:ScenePoint, arm:SceneArm) {
  const outline = sampledOutline(arm)
  return Math.min(...outline.slice(1).map((end,i) => {
    const start = outline[i]!, dx = end.x-start.x, dy = end.y-start.y
    const lengthSquared = dx*dx+dy*dy
    const t = lengthSquared ? Math.min(1,Math.max(0,((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSquared)) : 0
    return Math.hypot(point.x-start.x-t*dx, point.y-start.y-t*dy)
  }))
}

describe('sampled scene contact and silhouette',()=>{
  it('uses the 160/640/320 gesture phases with continuous zero-velocity boundaries',()=>{
    expect(simpleGesturePulse(0)).toBe(0)
    expect(simpleGesturePulse(160/1120)).toBeCloseTo(.04,12)
    expect(simpleGesturePulse(800/1120)).toBe(1)
    expect(simpleGesturePulse(1)).toBe(0)
    for(const boundary of [0,160/1120,800/1120,1]){
      const value=simpleGesturePulse(boundary),epsilon=.00001
      for(const side of [-1,1])expect(Math.abs(simpleGesturePulse(boundary+epsilon*side)-value)/epsilon).toBeLessThan(.001)
    }
  })
  it('keeps finite broad arms and anchored shoulders across all intermediate poses',()=>{
    for(const id of ids)for(let i=0;i<=100;i++){
      const progress=i/100,f=sampleScenePose({id,progress,activityProgress:progress,actionKind:'beat',actionProgress:progress})
      expect(JSON.stringify(f),`${id} ${progress}`).not.toMatch(/NaN|Infinity/)
      for(const [side,a] of [['left',f.left],['right',f.right]] as const){
        expect(sceneArmPath(a)).not.toMatch(/NaN|Infinity/)
        expect(a.points.length).toBe(32)
        expect(outlineArea(a),`${id} ${side} area at ${progress}`).toBeGreaterThan(100)
        expect(distance({x:a.points[0]!,y:a.points[1]!},{x:f.body.x+(side==='left'?69:171),y:f.body.y+105}),`${id} ${side} shoulder`).toBeLessThan(2)
        expect(distance({x:a.points[0]!,y:a.points[1]!},a.palm),`${id} ${side} reach at ${progress}`).toBeLessThan(90)
      }
    }
  })
  it('preserves cup size and exact scaled/rotated hand contacts',()=>{
    for(const id of ['F4','R3'] as const)for(let i=0;i<=100;i++){
      const f=sampleScenePose({id,progress:i/100,activityProgress:i/100,actionKind:'beat',actionProgress:i/100})
      expect(f.cup.scale).toBe(.72)
      for(const c of f.contacts.filter(c=>c.active&&c.name.startsWith('cup'))){
        const local=c.name==='cup-base'?SCENE_CUP_BASE:SCENE_CUP_HANDLE
        const actual=transformScenePoint({x:local.x*f.cup.scale,y:local.y*f.cup.scale},f.cup)
        expect(distance(c.hand,actual),`${id} ${c.name} ${i}`).toBeLessThan(.001)
      }
    }
  })
  it('keeps visible grip contacts attached throughout sampled actions',()=>{
    for(const id of ids)for(let i=0;i<=100;i++){
      const f=sampleScenePose({id,progress:i/100,activityProgress:i/100,actionKind:'beat',actionProgress:i/100})
      for(const c of f.contacts.filter(c=>c.active))expect(distance(c.hand,c.prop),`${id} ${c.name} ${i}`).toBeLessThan(.05)
    }
  })
  it('does not jump hands between adjacent handling samples',()=>{
    for(const id of ids){let previous=sampleScenePose({id,progress:0,activityProgress:0})
      for(let i=1;i<=1000;i++){const next=sampleScenePose({id,progress:i/1000,activityProgress:i/1000})
        expect(distance(previous.left.palm,next.left.palm),`${id} left ${i}`).toBeLessThan(4)
        expect(distance(previous.right.palm,next.right.palm),`${id} right ${i}`).toBeLessThan(4)
        previous=next
      }
    }
  })
  it('uses one fixed block inventory and a constant-sized boat through transfer',()=>{
    for(let i=0;i<=100;i++){const p=i/100,blocks=sampleScenePose({id:'F7',progress:p}),boat=sampleScenePose({id:'F6',progress:p})
      expect(blocks.blocks).toHaveLength(4);expect(boat.boat.scale).toBe(.71)
    }
    const end=sampleScenePose({id:'F6',progress:1})
    expect(end.boat.x).toBe(242);expect(end.boat.y).toBeCloseTo(0)
  })
  it('supports the rotating cover edge throughout closure, including the handoff',()=>{
    for(let i=0;i<=1000;i++){
      const frame=sampleScenePose({id:'F3',progress:i/1000})
      if(frame.book.close===0||frame.book.close===1)continue
      const { x,y }=frame.book.coverEdge
      // The projected front corner is 8 units to the right and 14 down.
      const rightGrip={x:x+8*.12,y:y+14*.12},leftGrip={x:x+8*.94,y:y+14*.94}
      expect(Math.min(distance(frame.right.palm,rightGrip),distance(frame.left.palm,leftGrip))).toBeLessThan(.001)
    }
    const closed=sampleScenePose({id:'F3',progress:1})
    expect(closed.book.coverEdge).toEqual({x:114,y:161})
    expect(closed.contacts.some(c=>c.name.startsWith('cover'))).toBe(false)
  })
  it('rests the hand and wand between bubble actions even as the host timer advances', () => {
    const resting = sampleScenePose({id:'F5', progress:0})
    for (const [host, released] of [[.25,0], [.399,0], [.65,1], [.95,2], [1,3]] as const) {
      const frame = sampleScenePose({id:'F5', progress:host, activityProgress:achievedSceneLandmark(host)})
      expect(distance(frame.right.palm, resting.right.palm)).toBeLessThan(.001)
      expect(distance(frame.wand, resting.wand)).toBeLessThan(.001)
      expect(frame.contacts.some(c => c.name === 'wand-handle' && c.active)).toBe(false)
      expect(frame.wand.breath).toBe(0)
      expect(frame.wand.bubbles.filter(b => b.radius > 0)).toHaveLength(released)
      expect(frame.wand.bubbles.filter(b => b.travel === 1)).toHaveLength(released)
    }
  })
  it.each([[0,.4,0], [.4,.75,1], [.75,1,2]] as const)(
    'withdraws, blows, and returns the wand during handling %s to %s',
    (start, end, bubbleIndex) => {
      const frames = Array.from({length:241}, (_, i) => sampleScenePose({
        id:'F5', progress:end, activityProgress:start + (end-start)*i/240,
      }))
      const immersed = frames[0]!.wand
      const blow = frames.find(f => f.wand.breath > .5)
      expect(blow).toBeDefined()
      const {jarX, rimY, rimWidth, rimDepth, ringWidth, ringDepth, length} = BUBBLE_WAND
      const ringAtMouth = blow!.wand.ring
      const lips = {x:blow!.body.x+128, y:blow!.body.y+110}, cheek = {x:blow!.body.x+154, y:blow!.body.y+111}
      expect(distance(ringAtMouth,lips)).toBeLessThan(15)
      expect(distance(ringAtMouth,cheek)).toBeGreaterThan(11)
      expect(immersed.ring.y).toBeGreaterThan(rimY)

      const elbowHeights: number[] = [], wristHeights: number[] = []
      for (const f of frames) {
        const {wand, right} = f
        // The first and fourth cubic endpoints are the outside and inside of the elbow.
        const elbowY = (right.points[7]! + right.points[25]!) / 2
        expect(elbowY - right.points[1]!).toBeGreaterThan(3)
        elbowHeights.push(elbowY)
        wristHeights.push(right.palm.y)
        expect(distance(wand, wand.ring)).toBeCloseTo(length, 3)
        expect(Math.abs(wand.angle-immersed.angle)).toBeLessThan(100)
        // Only the submerged arc of the inclined ellipse has to fit the jar opening.
        let submergedExtent = 0
        for (let j = 0; j < 32; j++) {
          const angle = 2 * Math.PI * j / 32
          const rim = transformScenePoint({
            x:ringWidth*Math.cos(angle), y:length+ringDepth*Math.sin(angle),
          }, wand)
          if (rim.y >= rimY-rimDepth) submergedExtent = Math.max(submergedExtent, Math.abs(rim.x-jarX))
        }
        expect(submergedExtent).toBeLessThan(rimWidth)
        if (distance(wand, immersed) > .1 || wand.breath > 0) {
          expect(distance(right.palm, wand)).toBeLessThan(.05)
          expect(f.contacts.some(c => c.name === 'wand-handle' && c.active)).toBe(true)
        }
        const bubble = wand.bubbles[bubbleIndex]!
        // Allow for both outline strokes as the released bubble arcs past the paw.
        if (bubble.travel > 0) expect(distanceToOutline(bubble,right)).toBeGreaterThan(bubble.radius + 1.5)
      }
      // The forearm does most of the lifting; the tucked upper arm should follow gently.
      const elbowRange = Math.max(...elbowHeights) - Math.min(...elbowHeights)
      const wristRange = Math.max(...wristHeights) - Math.min(...wristHeights)
      expect(wristRange).toBeGreaterThan(10)
      expect(elbowRange).toBeLessThan(wristRange * .75)
      expect(Math.min(...frames.map(f => f.wand.ring.y))).toBeGreaterThan(ringAtMouth.y - 6)
      const release = frames.find(f => f.wand.bubbles[bubbleIndex]!.travel > 0)!.wand
      const bubble = release.bubbles[bubbleIndex]!
      expect(release.breath).toBeGreaterThan(0)
      expect(distance(bubble, release.ring)).toBeLessThan(bubble.radius + 1)
      expect(frames.at(-1)!.wand.bubbles[bubbleIndex]!.y).toBeLessThan(bubble.y-15)
    },
  )
  it('retains a rounded palm and comparable limb area during the boat and tower carries',()=>{
    for(const id of ['F6','F7'] as const){
      const areas={left:[] as number[],right:[] as number[]}
      for(let i=0;i<=1000;i++){
        const frame=sampleScenePose({id,progress:i/1000})
        for(const side of ['left','right'] as const){
          const a=frame[side],p=a.points
          areas[side].push(outlineArea(a))
          expect(Math.hypot(p[12]!-p[18]!,p[13]!-p[19]!)).toBeGreaterThan(8)
        }
      }
      for(const samples of Object.values(areas))expect(Math.max(...samples)/Math.min(...samples)).toBeLessThan(2.1)
    }
  })
  it('rests each block on the solid face below and sets the flag inside the top footprint',()=>{
    const frame=sampleScenePose({id:'F7',progress:1})
    const [base,,middle,top]=frame.blocks
    expect(middle!.y).toBe(base!.y-BLOCK_HEIGHT)
    expect(top!.y).toBe(middle!.y-BLOCK_HEIGHT)
    expect(top!.x).toBe(middle!.x)
    expect(frame.flag.y).toBeGreaterThan(top!.y-BLOCK_HEIGHT-6)
    expect(frame.flag.y).toBeLessThan(top!.y-BLOCK_HEIGHT)
    expect(frame.flag.x).toBeGreaterThan(top!.x+6)
    expect(frame.flag.x).toBeLessThan(top!.x+25)
  })
  it('relaxes interrupted plant, wand and stretch actions from their current pose',()=>{
    for(const id of ['F2','F5','R1'] as const)for(const status of ['running','paused'] as const)for(const actionProgress of [.2,.5,.75]){
      const previous=sampleScenePose({id,status,progress:.75,activityProgress:.75,actionKind:'beat',actionProgress})
      const ending=sampleScenePose({id,status:'ended',progress:.75,activityProgress:.75,actionKind:'ending',actionProgress:0,endingFromActionProgress:actionProgress})
      expect(ending.left).toEqual(previous.left);expect(ending.right).toEqual(previous.right)
      expect(ending.body).toEqual(previous.body);expect(ending.wand).toEqual(previous.wand)
      const final=sampleScenePose({id,status:'ended',progress:.75,activityProgress:.75,actionKind:'ending',actionProgress:1,endingFromActionProgress:actionProgress})
      const idle=sampleScenePose({id,status:'ended',progress:.75,activityProgress:.75})
      expect(final.left).toEqual(idle.left);expect(final.right).toEqual(idle.right)
      expect(final.body).toEqual(idle.body);expect(final.wand).toEqual(idle.wand)
      for(let i=0;i<=100;i++){
        const f=sampleScenePose({id,status:'ended',progress:.75,activityProgress:.75,actionKind:'ending',actionProgress:i/100,endingFromActionProgress:actionProgress})
        expect(outlineArea(f.left)).toBeGreaterThan(100);expect(outlineArea(f.right)).toBeGreaterThan(100)
        for(const c of f.contacts.filter(c=>c.active))expect(distance(c.hand,c.prop)).toBeLessThan(.05)
      }
    }
  })
  it('starts an interrupted rest ending from the exact held sip pose',()=>{
    for(const status of ['running','paused'] as const)for(const sip of [.2,.5,.75]){
      const previous=sampleScenePose({id:'R3',status,progress:0,actionKind:'beat',actionProgress:sip})
      const ending=sampleScenePose({id:'R3',status:'ended',progress:0,actionKind:'ending',actionProgress:0,endingFromActionProgress:sip})
      expect(ending.cup).toEqual(previous.cup)
      expect(ending.left).toEqual(previous.left)
      expect(ending.right).toEqual(previous.right)
      const settled=sampleScenePose({id:'R3',status:'ended',progress:0,actionKind:'ending',actionProgress:1,endingFromActionProgress:sip})
      expect(settled.cup).toEqual(sampleScenePose({id:'R3',status:'ended',progress:0}).cup)
    }
  })
  it('sets the rest cup down before releasing the supporting hand',()=>{
    const initial=sampleScenePose({id:'R3',status:'running',progress:0})
    const begin=sampleScenePose({id:'R3',status:'ended',progress:0,actionKind:'ending',actionProgress:0})
    expect(begin.cup).toEqual(initial.cup)
    const final=sampleScenePose({id:'R3',status:'ended',progress:0,actionKind:'ending',actionProgress:1})
    expect(final).toEqual(sampleScenePose({id:'R3',status:'ended',progress:0}))
    expect(final.cup).toMatchObject({x:244,y:182,held:0})
    for(let i=0;i<=85;i++){const f=sampleScenePose({id:'R3',status:'ended',progress:0,actionKind:'ending',actionProgress:i/100});expect(f.contacts.find(c=>c.name==='cup-handle')?.active).toBe(true)}
  })
})
