import { describe, expect, it } from 'vitest'
import { sampleScenePose, type SceneArm, type ScenePoint } from './scene-pose'

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

  it('keeps rounded arms, fixed shoulders and continuous utensil motion at every sampled stage', () => {
    let previous=pose(0)
    for(let i=0;i<=1000;i++){
      const frame=pose(i/1000)
      expect(frame.left.points.slice(0,2)).toEqual([111,143])
      expect(frame.right.points.slice(0,2)).toEqual([213,143])
      expect(area(frame.left)).toBeGreaterThan(100)
      expect(area(frame.right)).toBeGreaterThan(100)
      for(const key of ['spoon','tip','soupSpoon','soupTip'] as const)expect(distance(frame.food[key],previous.food[key])).toBeLessThan(2)
      expect(distance(frame.left.palm,previous.left.palm)).toBeLessThan(2)
      expect(distance(frame.right.palm,previous.right.palm)).toBeLessThan(2)
      previous=frame
    }
  })
})
