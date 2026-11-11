import { describe, expect, it } from 'vitest'
import { sampleScenePose, type SceneArm, type ScenePoint } from './scene-pose'
import { BOWL_POUR_TILT, BOWL_SLIP_TILT, FOOD_BOWL, FOOD_DISHES, FOOD_POT_OPENING, FOOD_SLIPS, SPOON_LENGTH } from './scene-food-rig'

const pose = (progress: number) => sampleScenePose({ id: 'F1', progress, activityProgress: progress })
const distance = (a: ScenePoint, b: ScenePoint) => Math.hypot(a.x-b.x,a.y-b.y)
/** Points along the arm's drawn outline. */
function drawn(arm: SceneArm): ScenePoint[] {
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
  return points
}
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

const pot = FOOD_DISHES.pot
const inPot = (p: ScenePoint, margin = 0) => ((p.x-pot.x)/(FOOD_POT_OPENING.width+margin))**2 + ((p.y-pot.y)/(FOOD_POT_OPENING.depth+margin))**2
const resting = [0, .4, .75, 1]

describe('a pot of soup that obeys the kitchen\'s physics', () => {
  it('starts with full bowls and an empty pot, and ends with empty bowls and a full pot', () => {
    expect(pose(0).food).toMatchObject({greensLeft:1,extrasLeft:1,potGreens:0,potExtras:0,leftHeld:0,rightHeld:0,stirHeld:0,mix:0})
    expect(pose(.4).food).toMatchObject({greensLeft:0,potGreens:1,extrasLeft:1,potExtras:0})
    expect(pose(.75).food).toMatchObject({greensLeft:0,potGreens:1,extrasLeft:0,potExtras:1})
    expect(pose(1).food).toMatchObject({greensLeft:0,extrasLeft:0,potGreens:1,potExtras:1,simmer:1,mix:1,leftHeld:0,rightHeld:0,stirHeld:0})
  })

  it('never makes food appear or vanish: what leaves a bowl is in the pot', () => {
    let previous=pose(0).food
    for(let i=0;i<=2000;i++){
      const food=pose(i/2000).food
      expect(food.greensLeft+food.potGreens,`vegetables at ${i}`).toBeCloseTo(1,10)
      expect(food.extrasLeft+food.potExtras,`dumplings at ${i}`).toBeCloseTo(1,10)
      // Bowls only go down and the pot only goes up.
      expect(food.greensLeft).toBeLessThanOrEqual(previous.greensLeft); expect(food.extrasLeft).toBeLessThanOrEqual(previous.extrasLeft)
      expect(food.potGreens).toBeGreaterThanOrEqual(previous.potGreens); expect(food.potExtras).toBeGreaterThanOrEqual(previous.potExtras)
      previous=food
    }
  })

  it('lets a piece leave its bowl only when the bowl is tipped past the slip angle with its lip over the pot', () => {
    let previous=pose(0).food
    for(let i=1;i<=4000;i++){
      const food=pose(i/4000).food
      if(food.greensLeft<previous.greensLeft){
        expect(Math.abs(food.leftBowl.angle),`vegetables at ${i}`).toBeGreaterThan(BOWL_SLIP_TILT)
        // The lip rests on the rim: within a couple of units of the opening's edge.
        expect(inPot(food.leftLip,3),`vegetables at ${i}`).toBeLessThan(1)
        expect(food.leftHeld).toBe(1)
      }
      if(food.extrasLeft<previous.extrasLeft){
        expect(Math.abs(food.rightBowl.angle),`dumplings at ${i}`).toBeGreaterThan(BOWL_SLIP_TILT)
        expect(inPot(food.rightLip,3),`dumplings at ${i}`).toBeLessThan(1)
        expect(food.rightHeld).toBe(1)
      }
      previous=food
    }
    // Four pieces a bowl, each sliding off at its own moment while the bowl is held tipped.
    for(const slips of [FOOD_SLIPS.greens,FOOD_SLIPS.extras]){
      expect(slips).toHaveLength(4)
      slips.forEach((at,n)=>{ if(n>0)expect(at).toBeGreaterThan(slips[n-1]!+.004) })
    }
    expect(BOWL_POUR_TILT).toBeGreaterThan(BOWL_SLIP_TILT)
  })

  it('keeps a bowl level in the hand except at the pot\'s rim, and puts it back where it stood', () => {
    const home=pose(0).food
    for(let i=0;i<=2000;i++){
      const frame=pose(i/2000),food=frame.food
      for(const [bowl,lip,heldNow,palm,side,placed] of [[food.leftBowl,food.leftLip,food.leftHeld,frame.left.palm,1,home.leftBowl],[food.rightBowl,food.rightLip,food.rightHeld,frame.right.palm,-1,home.rightBowl]] as const){
        if(heldNow){
          // The palm holds the same point of the bowl throughout.
          const r=bowl.angle*Math.PI/180,gx=side*FOOD_BOWL.grip.x,gy=FOOD_BOWL.grip.y
          expect(distance(palm,{x:bowl.x+gx*Math.cos(r)-gy*Math.sin(r),y:bowl.y+gx*Math.sin(r)+gy*Math.cos(r)}),`grip at ${i}`).toBeLessThan(1e-9)
          // It only tips with its lip at the pot's rim, never on the way.
          if(Math.abs(bowl.angle)>1)expect(inPot(lip,4),`tipping at ${i}`).toBeLessThan(1)
        } else {
          expect(bowl,`bowl at ${i}`).toEqual(placed)
        }
        expect(Math.abs(bowl.angle)).toBeLessThanOrEqual(BOWL_POUR_TILT+1e-9)
      }
      for(const contact of frame.contacts.filter(c=>c.active))expect(distance(contact.hand,contact.prop)).toBeLessThan(1e-9)
    }
    // A bowl is picked up and set down without a jump.
    let previous=pose(0).food
    for(let i=1;i<=4000;i++){
      const food=pose(i/4000).food
      expect(distance(food.leftBowl,previous.leftBowl),`left bowl at ${i}`).toBeLessThan(.5)
      expect(distance(food.rightBowl,previous.rightBowl),`right bowl at ${i}`).toBeLessThan(.5)
      previous=food
    }
  })

  it('keeps the spoon rigid and in the pot, and stirs in circles', () => {
    const parked=pose(0).food
    const xs:number[]=[],ys:number[]=[]
    for(let i=0;i<=2000;i++){
      const p=i/2000,frame=pose(p),food=frame.food
      expect(distance(food.spoon,food.tip),`length at ${i}`).toBeCloseTo(SPOON_LENGTH,9)
      expect(inPot(food.tip),`tip at ${i}`).toBeLessThan(1)
      // The handle is above the rim and the tip below it: the spoon always leans into the pot.
      expect(food.spoon.y).toBeLessThan(pot.y-FOOD_POT_OPENING.depth)
      expect(food.tip.y).toBeGreaterThan(food.spoon.y+10)
      if(distance(food.spoon,parked.spoon)>1e-9){
        expect(food.stirHeld,`held at ${i}`).toBe(1)
        expect(distance(frame.right.palm,food.spoon)).toBeLessThan(1e-9)
      }
      if(p>=.80&&p<=.92){xs.push(food.tip.x);ys.push(food.tip.y)}
    }
    // A circle has width and depth; a wiggle would have only one.
    expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(2.5)
    expect(Math.max(...ys)-Math.min(...ys)).toBeGreaterThan(2)
    expect(pose(1).food.spoon).toEqual(parked.spoon)
    expect(pose(1).food.tip).toEqual(parked.tip)
    // Stirring is what mixes the pieces.
    expect(pose(.77).food.mix).toBe(0)
    expect(pose(.95).food.mix).toBe(1)
  })

  it('turns the same short arms from their shoulders and rests them between jobs', () => {
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
      expect(distance(frame.left.palm,previous.left.palm)).toBeLessThan(2)
      expect(distance(frame.right.palm,previous.right.palm)).toBeLessThan(2)
      expect(distance(frame.food.tip,previous.food.tip)).toBeLessThan(2)
      previous=frame
    }
    const rest=pose(0)
    for(const p of resting){
      expect(pose(p).left,`left at ${p}`).toEqual(rest.left)
      expect(pose(p).right,`right at ${p}`).toEqual(rest.right)
    }
  })

  it('stands the bowls and the pot well back from the table\'s edge, clear of the arms at rest', () => {
    // A vessel's silhouette: its rim's ellipse above the middle and its rounded body below.
    const inBowl=(p:ScenePoint,bowl:{x:number;y:number})=>((p.x-bowl.x)/FOOD_BOWL.width)**2+((p.y-bowl.y)/(p.y<bowl.y?FOOD_BOWL.depth:FOOD_BOWL.body))**2<1
    const inPotShape=(p:ScenePoint)=>((p.x-pot.x)/(FOOD_POT_OPENING.width+1))**2+((p.y-pot.y)/(p.y<pot.y?FOOD_POT_OPENING.depth+.5:FOOD_POT_OPENING.body))**2<1
    for(const p of resting){
      const frame=pose(p)
      for(const side of ['left','right'] as const)for(const point of [...drawn(frame[side]),frame[side].palm]){
        expect(inBowl(point,frame.food.leftBowl)||inBowl(point,frame.food.rightBowl),`${side} over a bowl at ${p}`).toBe(false)
      }
    }
    // An arm never reaches the pot, and never the other hand's bowl.
    for(let i=0;i<=1000;i++){
      const frame=pose(i/1000)
      for(const point of drawn(frame.left)){
        expect(inPotShape(point),`left over the pot at ${i}`).toBe(false)
        expect(inBowl(point,frame.food.rightBowl),`left over the right bowl at ${i}`).toBe(false)
      }
      for(const point of drawn(frame.right)){
        expect(inPotShape(point),`right over the pot at ${i}`).toBe(false)
        expect(inBowl(point,frame.food.leftBowl),`right over the left bowl at ${i}`).toBe(false)
      }
    }
    // The three vessels stand side by side without touching, the bowls mirrored about the pot.
    const {leftBowl,rightBowl}=pose(0).food
    expect(leftBowl.x+FOOD_BOWL.width).toBeLessThan(pot.x-FOOD_POT_OPENING.width-2)
    expect(rightBowl.x-FOOD_BOWL.width).toBeGreaterThan(pot.x+FOOD_POT_OPENING.width+2)
    expect(leftBowl.x+rightBowl.x).toBeCloseTo(2*pot.x,6)
    // Safe on the table: each foot is well behind the front edge and in front of the back edge,
    // across its whole width. The tabletop is an ellipse 125 by 17 around (160, 180).
    const edge=(x:number)=>17*Math.sqrt(1-((x-160)/125)**2)
    for(const [x,foot,half] of [[leftBowl.x,leftBowl.y+FOOD_BOWL.body,9],[rightBowl.x,rightBowl.y+FOOD_BOWL.body,9],[pot.x,pot.y+FOOD_POT_OPENING.body,13]] as const){
      for(const dx of [-half,0,half]){
        expect(180+edge(x+dx)-foot,`front margin at ${x+dx}`).toBeGreaterThan(6)
        expect(foot-(180-edge(x+dx)),`back margin at ${x+dx}`).toBeGreaterThan(6)
      }
    }
  })
})
