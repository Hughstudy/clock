import { describe, expect, it } from 'vitest'
import { sampleScenePose, type SceneArm, type ScenePoint } from './scene-pose'
import { SPOON_RESTS } from './scene-food-rig'

const pose = (progress: number) => sampleScenePose({ id: 'F1', progress, activityProgress: progress })
const distance = (a: ScenePoint, b: ScenePoint) => Math.hypot(a.x-b.x,a.y-b.y)
function area(arm: SceneArm): number {
  const points: ScenePoint[] = [{x:arm.points[0]!,y:arm.points[1]!}]
  let current=points[0]!
  for(let i=2;i<arm.points.length;i+=6){
    const [x1,y1,x2,y2,x3,y3]=arm.points.slice(i,i+6) as [number,number,number,number,number,number]
    for(let n=1;n<=12;n++){
      const t=n/12,u=1-t
      points.push({x:u*u*u*current.x+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,y:u*u*u*current.y+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3})
    }
    current={x:x3,y:y3}
  }
  return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length]!;return sum+p.x*q.y-q.x*p.y},0))/2
}

describe('food preparation contact sequence', () => {
  it('develops vegetables, then plated rice, then soup rather than starting with a finished meal', () => {
    expect(pose(0).food).toMatchObject({greens:0,rice:0,soup:0,leftHeld:0,rightHeld:0})
    expect(pose(.4).food).toMatchObject({greens:1,rice:0,soup:0})
    expect(pose(.67).food).toMatchObject({greens:1,rice:1,soup:0})
    expect(pose(1).food).toMatchObject({greens:1,rice:1,soup:1,leftHeld:0,rightHeld:0})
  })

  it('keeps each spoon rigid and supported by a hand whenever it leaves its rest', () => {
    const parked=pose(0).food
    for(let i=0;i<=1000;i++){
      const frame=pose(i/1000),food=frame.food
      expect(distance(food.spoon,food.tip)).toBeCloseTo(26,10)
      expect(distance(food.soupSpoon,food.soupTip)).toBeCloseTo(26,10)
      if(distance(food.spoon,parked.spoon)>.00001){
        expect(food.leftHeld).toBe(1)
        expect(distance(frame.left.palm,food.spoon)).toBeLessThan(.00001)
      }
      if(distance(food.soupSpoon,parked.soupSpoon)>.00001){
        expect(food.rightHeld).toBe(1)
        expect(distance(frame.right.palm,food.soupSpoon)).toBeLessThan(.00001)
      }
      for(const contact of frame.contacts.filter(c=>c.active))expect(distance(contact.hand,contact.prop)).toBeLessThan(.00001)
    }
    expect(pose(1).food.spoon).toEqual(parked.spoon)
    expect(pose(1).food.soupSpoon).toEqual(parked.soupSpoon)
  })

  it('turns the same short arms from their shoulders while the spoons travel', () => {
    let previous=pose(0)
    const restArea = {left: area(previous.left), right: area(previous.right)}
    for(let i=0;i<=1000;i++){
      const frame=pose(i/1000)
      expect(frame.left.points.slice(0,2)).toEqual([111,143])
      expect(frame.right.points.slice(0,2)).toEqual([213,143])
      for(const side of ['left','right'] as const) {
        expect(area(frame[side])).toBeCloseTo(restArea[side], 7)
        const shoulder = {x:frame[side].points[0]!, y:frame[side].points[1]!}
        expect(distance(frame[side].palm, shoulder)).toBeCloseTo(Math.hypot(22,25), 7)
      }
      for(const key of ['spoon','tip','soupSpoon','soupTip'] as const)expect(distance(frame.food[key],previous.food[key])).toBeLessThan(2)
      expect(distance(frame.left.palm,previous.left.palm)).toBeLessThan(2)
      expect(distance(frame.right.palm,previous.right.palm)).toBeLessThan(2)
      previous=frame
    }
  })

  it('reaches each dish with the spoon bowl rather than a hand', () => {
    const vegetables = pose(.2).food, rice = pose(.5).food, soup = pose(.8).food
    expect(distance(vegetables.tip, {x:101,y:163})).toBeLessThan(9)
    expect(distance(rice.tip, {x:158,y:180})).toBeLessThan(6)
    expect(distance(soup.soupTip, {x:221,y:163})).toBeLessThan(8)
    expect(vegetables.spoon.x).toBeGreaterThan(125)
    expect(rice.spoon.x).toBeLessThan(140)
    expect(soup.soupSpoon.x).toBeLessThan(198)
  })

  it('parks the handles on the rests with the entire spoon bowl over the tabletop', () => {
    const {spoon, tip, soupSpoon, soupTip} = pose(0).food
    for (const [i, [grip, bowl]] of ([[spoon, tip], [soupSpoon, soupTip]] as const).entries()) {
      const rest = SPOON_RESTS[i]!
      const t = (rest.y - grip.y) / (bowl.y - grip.y)
      const x = grip.x + t * (bowl.x - grip.x)
      expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(1)
      expect(x).toBeGreaterThan(rest.x); expect(x).toBeLessThan(rest.x + rest.w)
      const tilt = Math.atan2(bowl.y - grip.y, bowl.x - grip.x)
      for (let j = 0; j < 64; j++) {
        const angle = j * 2 * Math.PI / 64
        const dx = 6 * Math.cos(angle), dy = 3 * Math.sin(angle)
        const x = bowl.x + dx * Math.cos(tilt) - dy * Math.sin(tilt)
        const y = bowl.y + dx * Math.sin(tilt) + dy * Math.cos(tilt)
        expect(((x-160)/125)**2 + ((y-180)/17)**2).toBeLessThan(1)
      }
    }
  })
})
