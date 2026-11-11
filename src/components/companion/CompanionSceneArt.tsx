import { useId, type CSSProperties, type ReactNode } from 'react'
import { CompanionPaint } from './CompanionPaint'
import { CompanionScenery } from './CompanionScenery'
import type { CompanionScene } from '../../contracts/presentation'
import { blueCompanionSpec } from '../../data/blue-companion'
import { useSceneLight } from '../../hooks/companion/useSceneLight'
import { sceneArtPalette, sceneArtSketch } from '../../data/scene-art'
import { BOWL_POUR_TILT, FOOD_BOWL, FOOD_DISHES, FOOD_POT_OPENING, FOOD_SLIPS, SPOON_LENGTH } from '../../logic/scene-food-rig'
import { BLOCK_HEIGHT, BOAT_TRAY, BUBBLE_WAND, focusAttentionTransforms, PLANT_POT, sampleScenePose, sceneArmPath, sceneSmooth, TEA_CUP_HOME, type ScenePoseFrame } from '../../logic/scene-pose'

export function ScenePart({ name, className, transform }: { name: string; className?: string; transform?: string }) {
  return <g className={className} transform={transform} data-scene-part={name}>
    {sceneArtSketch.parts[name]?.paths.map((path, i) => <path key={i} d={path.d} fill={path.fill ? sceneArtPalette[path.fill] : 'none'} stroke={path.stroke ? sceneArtPalette[path.stroke] : undefined} strokeWidth={path.width} strokeLinecap="round" strokeLinejoin="round" />)}
  </g>
}
const P = ({d,c='line',...props}:{d:string;c?:string;opacity?:number;transform?:string}) => <path className={`scene-draw-${c}`} d={d} {...props}/>
const E = ({x,y,rx,ry,c='shadow',...props}:{x:number;y:number;rx:number;ry:number;c?:string;opacity?:number}) => <ellipse className={`scene-draw-${c}`} cx={x} cy={y} rx={rx} ry={ry} {...props}/>
const R = ({x,y,w,h,c='paper',r=3}:{x:number;y:number;w:number;h:number;c?:string;r?:number}) => <rect className={`scene-draw-${c}`} x={x} y={y} width={w} height={h} rx={r}/>
const clamp=(v:number)=>Math.min(1,Math.max(0,v))
const stage=(p:number,a:number,b:number)=>sceneSmooth((p-a)/(b-a))
function Ground(){return <g data-scene-part="ground"><E x={160} y={220} rx={137} ry={10}/><P d="M28 220 Q160 235 294 220" c="softline"/></g>}
function Table({tea=false}:{tea?:boolean}){return tea?<g data-scene-part="tea-table" transform="translate(-8 0)"><P d="M72 188 L74 220 Q78 223 83 219 L85 190 M176 190 L182 219 Q186 223 191 219 L188 188" c="edge"/><P d="M46 184 L46 189 Q129 205 214 189 L214 184" c="edge"/><E x={130} y={184} rx={84} ry={13} c="table"/></g>:<g data-scene-part="table"><P d="M55 185 L54 220 Q59 224 65 220 L70 187 M248 187 L254 220 Q260 224 266 220 L265 185" c="edge"/><P d="M35 180 L35 187 Q159 210 285 187 L285 180" c="edge"/><E x={160} y={180} rx={125} ry={17} c="table"/><P d="M47 181 Q159 200 274 181" c="softline"/></g>}
function Mat(){return <g data-scene-part="mat"><P d="M59 196 Q160 184 267 199 L285 217 Q154 238 37 218 Z" c="light"/><P d="M55 217 Q160 231 271 215" c="softline"/></g>}
function Cushion(){return <g data-scene-part="cushion"><P d="M103 191 Q86 182 91 206 Q151 231 230 209 Q244 191 224 188 Q165 204 103 191Z" c="light"/><P d="M106 209 Q165 218 219 207" c="softline"/></g>}
// Narrow enough to stand clear of the right arm at rest; the cup's saucer sits at its near side.
function SideTable(){return <g data-scene-part="side-table"><P d="M216 178 L216 217 M250 178 L250 215"/><E x={233} y={178} rx={23} ry={9} c="table"/><E x={226} y={177} rx={15} ry={3.5} c="paper"/></g>}
function Steam({x, y, amount = 1}: {x: number; y: number; amount?: number}) {
  const curls = ['M0 0 C12 -9 -9 -17 1 -28', 'M13 0 C27 -13 3 -22 15 -37', 'M-12 1 C0 -12 -22 -23 -9 -43']
  // The loop moves an inner group by transform; the placement stays on the outer one.
  return <g data-scene-part="steam" transform={`translate(${x} ${y})`}><g className="scene-rig-steam">
    {curls.map((d,i) => <P key={d} d={d} c="steam" opacity={clamp(amount-i)*.7}/>)}
  </g></g>
}
function Cup({frame}:{frame:ScenePoseFrame}){const c=frame.cup,l=c.liquid;return <g data-scene-part="cup" data-held={c.held>.99} transform={`translate(${c.x} ${c.y}) rotate(${c.angle}) scale(${c.scale})`}><P d="M20 -18 C37 -21 38 -3 21 -4 L21 -9 C31 -7 31 -17 21 -14" c="paper"/><P d="M-18 -21 L23 -21 L20 -3 Q1 7 -14 -3 Z" c="paper"/><E x={2} y={-21} rx={20} ry={4} c="paper"/><E x={2} y={-21+1.6*(1-l)} rx={11+7*l} ry={1.8+1.2*l} c="edge" opacity={Math.min(1,l*3)}/></g>}
/** Water leaves the spout level and falls along a parabola into the cup's opening. */
function Pour({frame}:{frame:ScenePoseFrame}){
  const {spout,pour}=frame.kettle,c=frame.cup,x=spout.x+5,y=c.y-21*c.scale+1
  const state=pour>0?'pouring':c.liquid>0?'done':'waiting'
  return <path className="scene-draw-pour" data-scene-part="pour" data-pour={state} pathLength={1} d={`M${spout.x} ${spout.y} Q${(spout.x+x)/2} ${spout.y} ${x} ${y}`}/>
}
function Plant({progress:p}:{progress:number}) {
  const {x,rimY,rimWidth,rimDepth,bodyWidth,baseWidth,baseY,floorY}=PLANT_POT,h=13+42*p
  return <g data-scene-part="plant">
    <E x={x} y={floorY-2} rx={baseWidth+2} ry={2}/>
    <g data-scene-part="plant-pot">
      <P d={`M${x-bodyWidth} ${rimY} H${x+bodyWidth} L${x+baseWidth} ${baseY} Q${x} ${baseY+6} ${x-baseWidth} ${baseY} Z`} c="table"/>
      <E x={x} y={rimY} rx={rimWidth} ry={rimDepth} c="edge"/>
    </g>
    <g data-scene-part="plant-growth" transform={`translate(${x} ${rimY-144}) scale(${rimWidth/26} 1) translate(-92 0)`}>
      <P d={`M92 143 Q95 ${141-h/2} 91 ${143-h}`}/>
      <P d={`M92 ${139-h*.3} Q67 ${134-h*.7} 70 ${128-h*.7} Q91 ${125-h*.5} 92 ${139-h*.3} Z M92 ${135-h*.6} Q113 ${127-h} 118 ${132-h} Q116 ${147-h*.5} 92 ${135-h*.6} Z`} c="green"/>
      <g transform={`translate(91 ${143-h}) scale(${.3+.7*stage(p,.7,1)})`}>
        {[-1,1].map(n=><E key={n} x={n*9} y={0} rx={8} ry={9} c="pink" opacity={stage(p,.6,.9)}/>)}
        <E x={0} y={-9} rx={8} ry={9} c="pink" opacity={stage(p,.6,.9)}/><E x={0} y={9} rx={8} ry={9} c="pink" opacity={stage(p,.6,.9)}/><E x={0} y={0} rx={5} ry={5} c="edge" opacity={stage(p,.6,.9)}/>
      </g>
    </g>
  </g>
}
function Kettle({frame,front=false}:{frame:ScenePoseFrame;front?:boolean}){
  const k=frame.kettle
  return <g data-scene-part={front?'kettle':'kettle-handle'} transform={`translate(${k.x} ${k.y}) rotate(${k.angle})`}>
    {front ? <>
      <P d="M17 -23 Q28 -23 38 -31 L45 -34 L47 -30 Q41 -29 38 -25 Q28 -16 19 -15Z" c="green"/>
      <P d="M-17 -29 Q-24 -16 -18 -3 Q0 6 18 -3 Q23 -18 16 -29 Z" c="green"/>
      <P d="M-17 -29 Q0 -39 17 -29Z" c="green"/><R x={-4} y={-37} w={8} h={5} c="edge"/>
    </> : <P d="M-17 -29 C-28 -49 28 -49 17 -29" c="handle"/>}
  </g>
}
/** A prep bowl. Its pieces slide toward the lip as it tips and are gone once they have fallen. */
function FoodBowl({bowl,kind,amount}:{bowl:ScenePoseFrame['food']['leftBowl'];kind:'greens'|'extras';amount:number}) {
  const {width:w,depth:h,body}=FOOD_BOWL,a=clamp(amount),toLip=Math.sign(bowl.angle)*4*clamp(Math.abs(bowl.angle)/BOWL_POUR_TILT)
  return <g data-scene-part={`bowl-${kind}`} data-amount={a} transform={`translate(${bowl.x} ${bowl.y}) rotate(${bowl.angle})`}>
    <P d={`M${-w} 0 Q${-w+.5} ${body-.5} 0 ${body} Q${w-.5} ${body-.5} ${w} 0 Z`} c="paper"/>
    <E x={0} y={0} rx={w} ry={h} c="paper"/>
    <g transform={`translate(${toLip} 0)`}>
      {/* Four pieces; the one nearest the lip leaves first. */}
      {kind==='greens'
        ?[[-7,-1.2],[-2,-2.6],[3,-1],[7,-2]].map(([dx=0,dy=0],i)=><g key={i} transform={`translate(${dx} ${dy}) scale(.25)`} opacity={a>(3-i)*.25+.125?1:0}><P d="M-18 3 Q-24 -13 -13 -11 Q-12 -21 -4 -12 Q5 -20 9 -10 Q20 -14 20 0 Q9 8 -18 3 Z" c="green"/></g>)
        :[[-7,-.6],[-1.5,-2.4],[3.5,-.4],[8,-1.8]].map(([dx=0,dy=0],i)=><E key={i} x={dx} y={dy} rx={3.9} ry={2.6} c="paper" opacity={a>(3-i)*.25+.125?1:0}/>)}
    </g>
  </g>
}
/** Where each bowl's lip is while its pieces slide off, so they fall from there into the broth. */
const FOOD_DROPS={
  greens:FOOD_SLIPS.greens.map(progress=>sampleScenePose({id:'F1',progress}).food.leftLip),
  extras:FOOD_SLIPS.extras.map(progress=>sampleScenePose({id:'F1',progress}).food.rightLip),
}
const mixed=(from:readonly [number,number],to:readonly [number,number],t:number)=>[from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t] as const
/** The pot fills with what the bowls tip in: each piece falls, the broth rises, and stirring mixes it. */
function FoodPot({frame}:{frame:ScenePoseFrame}) {
  const {potGreens:g,potExtras:e,simmer,mix}=frame.food,{x,y}=FOOD_DISHES.pot,{width:w,depth:h,body}=FOOD_POT_OPENING
  // Whatever goes in raises the broth a little.
  const surface=1.5-1.5*(g+e)
  const piece=(kind:'greens'|'extras',i:number,landing:readonly [number,number],stirred:readonly [number,number],share:number)=>{
    // Each piece starts at the bowl's lip and drops in its own time, then drifts as the spoon stirs.
    const from=FOOD_DROPS[kind][i]!,landed=share>i*.25+.125,[dx,dy]=mixed(landing,stirred,mix)
    return <g key={kind+i} className="scene-fall" data-landed={landed} style={{'--fall-x':`${from.x-x-dx}px`,'--fall-y':`${from.y-y-surface-dy}px`} as CSSProperties}>
      {kind==='greens'?<E x={dx} y={surface+dy} rx={3.4} ry={1.5} c="green"/>:<E x={dx} y={surface+dy} rx={3.6} ry={1.9} c="paper"/>}
    </g>
  }
  const greens=[[[-15,.2],[-12,.6]],[[-10,1.9],[5,2]],[[-12,-1.5],[-3,-1.6]],[[-6,.3],[13,-.5]]] as const
  const extras=[[[15,.2],[12,1.2]],[[10,1.9],[-7,1.8]],[[12,-1.5],[3,.3]],[[6,.3],[-14,-.9]]] as const
  return <g data-scene-part="pot" data-filled={g+e} transform={`translate(${x} ${y})`}>
    <E x={0} y={body} rx={20} ry={3}/>
    <path className="scene-draw-pink" d={`M-${w+1} 0 L${w+1} 0 Q${w+1} ${body-2} 13 ${body} H-13 Q-${w+1} ${body-2} -${w+1} 0 Z`} stroke="var(--scene-line)" strokeWidth="1.5"/>
    <E x={0} y={0} rx={w+1} ry={h+.5} c="paper"/>
    <g data-scene-part="broth">
      <ellipse className="scene-draw-water" cx={0} cy={surface} rx={w-4} ry={h-1.6}/>
      <ellipse className="scene-draw-edge" cx={0} cy={surface} rx={w-4} ry={h-1.6} opacity={.2*(g+e)+.6*simmer}/>
      {greens.map(([landing,stirred],i)=>piece('greens',i,landing,stirred,g))}
      {extras.map(([landing,stirred],i)=>piece('extras',i,landing,stirred,e))}
    </g>
  </g>
}
/** A rigid spoon standing in the pot. */
function FoodSpoon({grip,tip,held}:{grip:{x:number;y:number};tip:{x:number;y:number};held:number}) {
  const angle=Math.atan2(tip.y-grip.y,tip.x-grip.x)*180/Math.PI
  return <g data-scene-part="soup-spoon" data-held={held>.999} transform={`translate(${grip.x} ${grip.y}) rotate(${angle})`}>
    <P d={`M-3 0 L${SPOON_LENGTH-4} 0`} c="handle"/><E x={SPOON_LENGTH} y={0} rx={6} ry={3} c="paper"/>
  </g>
}
function Book({frame}:{frame:ScenePoseFrame}){
  const { close, turn, corner, coverEdge, coverFront, ribbon } = frame.book
  const { x, y } = coverEdge
  const spine = {x:150,y:169}
  const midX = (spine.x+x)/2, midY = (spine.y+y)/2
  const cover = `M150 169 Q${midX} ${midY-2} ${x} ${y} L${coverFront.x} ${coverFront.y} Q${midX+29} ${midY+9} 179 180 Z`
  const outerCover = stage(close,.44,.55)
  return <g data-scene-part="book">
    <P d="M111 162 L150 169 L179 180 L179 183 L140 176 L111 165 Z" c="green"/>
    <P d="M111 162 Q133 160 152 169 L179 180 Q153 174 140 173 Z" c="paper"/>
    {[0,1].map(i=><P key={i} d={`M${123+5*i} ${165+i*4} Q139 ${165+i*4} ${149+5*i} ${170+i*4}`} c="softline"/>)}
    <P d={cover} c="paper"/>
    <g opacity={1-outerCover}>
      {[0,1].map(i=><P key={i} d={`M${154+(x-150)*.15+5*i} ${172+i*4+(y-162)*.15} Q${midX+4} ${midY+1+i*4} ${155+(x-150)*.83+5*i} ${y+4+i*4}`} c="softline"/>)}
    </g>
    <P d={`M150 169 Q${(150+corner.x)/2} ${corner.y-4} ${corner.x} ${corner.y} l29 11 Q${(150+corner.x)/2+29} ${corner.y+9} 179 180 Z`} c="paper" opacity={Math.sin(turn*Math.PI)*(1-close)}/>
    <g transform={`translate(${midX+7} ${midY})`} opacity={ribbon}>
      <P d="M-3 0 L3 -1 L12 19 L8 17 L6 20Z" c="pink"/>
    </g>
    <P d={cover} c="green" opacity={outerCover}/>
    <P d={`M${150+(x-150)*.13} ${169+(y-169)*.13} l29 11`} c="softline" opacity={outerCover}/>
  </g>
}
function Boat({frame}:{frame:ScenePoseFrame}){const p=frame.boat.fold,f1=stage(p,.12,.39),f2=stage(p,.43,.73);const dx=frame.boat.x-160,dy=frame.boat.y;const topX=173-9*f1,topY=157-12*f1+10*f2;return <g data-scene-part="paper-boat"><g data-scene-part="water-tray"><E x={BOAT_TRAY.x} y={BOAT_TRAY.y} rx={BOAT_TRAY.width} ry={BOAT_TRAY.depth} c="edge"/><E x={BOAT_TRAY.x} y={BOAT_TRAY.y-1.5} rx={BOAT_TRAY.width-4} ry={BOAT_TRAY.depth-1.8} c="water"/></g><g transform={`translate(${dx} ${dy}) translate(160 180) scale(${frame.boat.scale}) translate(-160 -180)`}><P d={`M${112+7*f1} ${169+8*f1} L${topX} ${topY} L${210-5*f1+3*f2} ${178-f1} L${146-8*f1} ${191-3*f1} Z`} c="paper"/><P d={`M${134+30*f1} ${167-22*f1+10*f2} L${190-26*f1} ${180+f2} M${119} 177 L164 181 L208 177`} c="softline"/><P d={`M${119+10*f2} 177 L${208-9*f2} 177 L${189-6*f2} 188 L${138+7*f2} 188 Z`} c="paper" opacity={f2}/><P d="M145 177 L164 153 L183 177Z" c="paper" opacity={f2}/><P d="M164 154 L164 178" c="softline" opacity={f2}/></g></g>}
function Block({x,y,angle,c}:{x:number;y:number;angle:number;c:string}){
  const top = -BLOCK_HEIGHT
  return <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <P d={`M0 ${top} l6 -6 h25 l-6 6 Z`} c="paper"/>
    <P d={`M25 ${top} l6 -6 v${BLOCK_HEIGHT} l-6 6 Z`} c={c}/>
    <P d={`M0 ${top} h25 V0 H0 Z`} c={c}/>
  </g>
}
function Bubbles({frame}:{frame:ScenePoseFrame}){
  const { wand } = frame, { ring } = wand
  const { jarX, rimY, rimWidth, rimDepth, length, ringWidth, ringDepth } = BUBBLE_WAND
  return <g data-scene-part="bubble-play">
    <g data-scene-part="breath" opacity={wand.breath}>
      <P d={`M168 148 Q172 148 ${ring.x-5} ${ring.y-2} M168 151 Q173 151 ${ring.x-5} ${ring.y+1}`} c="softline"/>
    </g>
    <E x={jarX} y={rimY+22} rx={22} ry={3.5}/>
    <E x={jarX} y={rimY} rx={rimWidth} ry={rimDepth} c="edge"/>
    <g data-scene-part="wand" transform={`translate(${wand.x} ${wand.y}) rotate(${wand.angle})`}>
      <P d={`M0 -6 V${length-ringDepth}`}/><E x={0} y={length} rx={ringWidth} ry={ringDepth} c="line"/>
    </g>
    <g data-scene-part="jar-front" transform={`translate(${jarX} ${rimY})`}>
      <P d={`M-${rimWidth} 0 C-${rimWidth} 7 ${rimWidth} 7 ${rimWidth} 0 L18 14 Q17 21 11 21 H-11 Q-17 21 -18 14Z`} c="green"/>
      <P d="M-14 7 L-13 13" c="softline"/>
    </g>
    {wand.bubbles.map(({x,y,radius:r,travel},i)=><g key={i} data-bubble={i} className={travel===1?'scene-rig-bubble':undefined} opacity={Math.min(1,r)}>
      <circle cx={x} cy={y} r={r} className="scene-draw-water" fillOpacity=".4"/>
      <P d={`M${x-r*.6} ${y-r*.2} Q${x-r*.6} ${y-r*.65} ${x-r*.2} ${y-r*.7}`} c="softline"/>
      {i===0 && <P transform={`translate(${x} ${y})`} d="M0 -2 C-7 -10 -13 -1 0 7 C13 -1 7 -10 0 -2Z" c="pink" opacity={wand.bubbles[2]?.travel ?? 0}/>}
    </g>)}
  </g>
}
function Star({x,y,r=5,opacity=1}:{x:number;y:number;r?:number;opacity?:number}){return <P d={`M${x} ${y-r} L${x+1.8} ${y-1.5} L${x+r} ${y} L${x+1.8} ${y+1.5} L${x} ${y+r} L${x-1.8} ${y+1.5} L${x-r} ${y} L${x-1.8} ${y-1.5}Z`} c="edge" opacity={opacity}/>}
function Cloud({x,y,scale=1}:{x:number;y:number;scale?:number}){return <g transform={`translate(${x} ${y}) scale(${scale})`}><g className="scene-rig-cloud"><P d="M-31 8 C-48 7 -44 -10 -31 -9 C-29 -31 -8 -30 -1 -15 C13 -24 29 -15 27 -2 C48 -5 47 13 31 13 L-29 13Z" c="paper"/></g></g>}
function Body({frame, happy}: {frame: ScenePoseFrame; happy: boolean}) {
  const part = (name: string, color: string) => {
    const art = blueCompanionSpec.parts[name]
    const squish = name === 'belly' || name === 'footLeft' || name === 'footRight'
    return art && <g data-part={name} data-touch-kind={squish ? 'squish' : undefined}><P d={art.d} c={color}/></g>
  }
  const restingEyes = frame.id === 'R1' || frame.id === 'R3'
  const attention = focusAttentionTransforms(frame.attention)
  return <g transform={`translate(${frame.body.x} ${frame.body.y})`} data-scene-part="creature">
    <E x={120} y={169} rx={54} ry={5}/>
    {part('footLeft','shade')}{part('footRight','shade')}
    {/* Only the torso and face move here, so hands stay on what they are holding. */}
    <g data-focus-rig="lean"><g className="scene-rig-breath" data-touch-kind="pat">
      <g data-focus-rig="fins">{part('tuft','body')}</g>{part('body','body')}{part('shine','highlight')}{part('belly','belly')}
      <g transform={attention.head}><g data-focus-rig="head">
        <g data-focus-rig="cheek-left">{part('cheekLeft','pink')}</g><g data-focus-rig="cheek-right">{part('cheekRight','pink')}</g>
        <g className="scene-rig-gaze" transform={`translate(${frame.gaze.x} ${frame.gaze.y})`}><g className="scene-rig-look">
          <g transform={attention.eyes}><g data-focus-rig="eyes"><g className="scene-rig-eyes">
            {happy || frame.touched ? part('eyesHappy','face') : restingEyes ? part('eyesResting','face') : <>
              {part('eyeLeft','ink')}{part('eyeRight','ink')}{part('eyeShineLeft','glint')}{part('eyeShineRight','glint')}
            </>}
          </g></g></g>
        </g></g>
        <g data-focus-rig="mouth">{frame.id === 'F5' ? <>
          <g opacity={1-frame.wand.breath}>{part('mouth','face')}</g>
          <ellipse cx="122" cy="110" rx="3" ry="2.2" className="scene-draw-ink" opacity={frame.wand.breath}/>
        </> : part('mouth','face')}</g>
      </g></g>
    </g></g>
  </g>
}
interface Props { scene: CompanionScene; frame?: ScenePoseFrame; night?: number }
/** Full persistent scene, with hand and prop geometry sampled from one pose. */
export function CompanionSceneArt({scene,frame:provided,night=0}:Props){
  const sky = useSceneLight('garden',night)!
  const paint = useId().replace(/:/g, '')
  const material = { '--scene-coat': `url(#${paint}-body)`, '--scene-belly': `url(#${paint}-belly)` } as CSSProperties
  const f=provided??sampleScenePose({id:scene.id,status:scene.status,progress:scene.completedProgress,staticOnly:true});const id=scene.id,p=f.progress;const lean=`rotate(${f.body.lean} ${f.body.x+120} ${f.body.y+160})`
  let back:ReactNode=null,objects:ReactNode=null,held:ReactNode=null
  const usesTable=['F1','F2','F3','F6','F7'].includes(id)
  const focusArm=(side:'left'|'right')=>f.flipperArm===side?{'data-focus-arm':`${f[side].points[0]} ${f[side].points[1]} ${side==='left'?1:-1}`}:undefined
  if(id==='F1'){
    objects=<>
      <FoodPot frame={f}/><FoodSpoon grip={f.food.spoon} tip={f.food.tip} held={f.food.stirHeld}/>
      {/* Short curls, so the steam stays below the face. */}
      <g transform={`translate(${FOOD_DISHES.pot.x-3} ${FOOD_DISHES.pot.y-5}) scale(.4)`}><Steam x={0} y={0} amount={.4*(f.food.potGreens+f.food.potExtras)+2*f.food.simmer}/></g>
    </>
    // The bowls are drawn over the hands, so a hand holds its bowl by the far rim.
    held=<><FoodBowl bowl={f.food.leftBowl} kind="greens" amount={f.food.greensLeft}/><FoodBowl bowl={f.food.rightBowl} kind="extras" amount={f.food.extrasLeft}/></>
  }
  if(id==='F2')objects=<><Plant progress={p}/><E x={f.left.palm.x-2} y={f.left.palm.y+5} rx={10} ry={2}/><E x={f.right.palm.x+2} y={f.right.palm.y+5} rx={10} ry={2}/></>
  if(id==='F3')objects=<Book frame={f}/>
  if(id==='F4'){objects=<><E x={66} y={183} rx={26} ry={4} c="edge"/><E x={TEA_CUP_HOME.x} y={183} rx={20} ry={4} c="paper"/><Kettle frame={f}/><Steam x={f.kettle.x} y={f.kettle.y-38} amount={.5+2.5*p}/></>;held=<><Kettle frame={f} front/><Cup frame={f}/><Pour frame={f}/><Steam x={f.cup.x} y={f.cup.y-17} amount={f.cup.liquid*(.6+f.cup.held*.5)*(1-stage(f.cup.x,186,204))}/></>}
  if(id==='F5')objects=<Bubbles frame={f}/>
  if(id==='F6')objects=<Boat frame={f}/>
  if(id==='F7')objects=<g data-scene-part="block-inventory">{f.blocks.map((b,i)=><g key={i} data-block={i}><Block {...b} c={['green','table','light','green'][i]??'green'}/></g>)}<g data-scene-part="flag" transform={`translate(${f.flag.x} ${f.flag.y}) rotate(${f.flag.angle})`}><P d="M0 0 L0 -24"/><path className="scene-draw-pink" d="M0 -24 L16 -18 L0 -12Z" stroke="var(--scene-line)" strokeWidth="1.4"/></g></g>
  if(id==='F8')back=<g data-scene-part="sky"><P d="M44 42 C19 49 28 75 49 70 C30 67 32 49 44 42Z" c="paper" opacity={Math.max(.5,sky.moon)}/><g opacity={sky.stars}>{[[260,44],[75,31],[285,105],[224,23],[36,116],[252,85]].map(([x=0,y=0],i)=><g className="scene-rig-star" key={i}><Star x={x} y={y} opacity={i<2?1:stage(p,(i-2)*.17,.2+(i-2)*.17)}/></g>)}<P d="M260 44 L252 85 L285 105" c="softline" opacity={stage(p,.3,.6)}/><g opacity={stage(p,.92,1)}><P d="M211 32 L174 51 M214 37 L187 53" c="softline"/><Star x={216} y={31} r={7}/></g></g></g>
  if(id==='R2')back=<g data-scene-part="clouds"><Cloud x={63} y={58} scale={.67}/><Cloud x={252} y={91} scale={.5}/></g>
  if(id==='R3'){objects=<SideTable/>;held=<><Cup frame={f}/><Steam x={f.cup.x-13} y={f.cup.y-18} amount={1-f.cup.held}/></>}
  return <g className="scene-rig" style={material} transform="scale(.75)" data-scene-part={`scene-${id}`} data-pose-progress={f.progress} data-contact-count={f.contacts.filter(c=>c.active).length} aria-hidden="true"><CompanionPaint id={paint}/><CompanionScenery scene={id} night={night}/><Ground/>{!usesTable&&id!=='F4'&&<Mat/>}{['F8','R2','R3'].includes(id)&&<Cushion/>}{back}<g transform={lean}><Body frame={f} happy={scene.status==='ended'||p===1}/></g>{usesTable&&<Table/>}{id==='F4'&&<Table tea/>}{objects}<g transform={lean} data-scene-part="arms" data-touch-kind="high-five"><path className="scene-draw-body" data-scene-hand="left" d={sceneArmPath(f.left)} {...focusArm('left')}/><path className="scene-draw-body" data-scene-hand="right" d={sceneArmPath(f.right)} {...focusArm('right')}/></g>{held}{f.contacts.map(c=><g key={c.name} data-scene-contact={c.name} data-contact-active={c.active} data-hand-x={c.hand.x} data-hand-y={c.hand.y} data-prop-x={c.prop.x} data-prop-y={c.prop.y}/>)}</g>
}
