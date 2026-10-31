import { useId, type CSSProperties, type ReactNode } from 'react'
import { CompanionPaint } from './CompanionPaint'
import { CompanionScenery } from './CompanionScenery'
import type { CompanionScene } from '../../contracts/presentation'
import { blueCompanionSpec } from '../../data/blue-companion'
import { sceneArtPalette, sceneArtSketch } from '../../data/scene-art'
import { BLOCK_HEIGHT, BUBBLE_WAND, sampleScenePose, sceneArmPath, sceneSmooth, type ScenePoseFrame } from '../../logic/scene-pose'

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
function Table({tea=false}:{tea?:boolean}){return tea?<g data-scene-part="tea-table"><P d="M72 188 L74 220 Q78 223 83 219 L85 190 M176 190 L182 219 Q186 223 191 219 L188 188" c="edge"/><P d="M60 184 L60 189 Q129 205 200 189 L200 184" c="edge"/><E x={130} y={184} rx={70} ry={13} c="table"/></g>:<g data-scene-part="table"><P d="M55 185 L54 220 Q59 224 65 220 L70 187 M248 187 L254 220 Q260 224 266 220 L265 185" c="edge"/><P d="M35 180 L35 187 Q159 210 285 187 L285 180" c="edge"/><E x={160} y={180} rx={125} ry={17} c="table"/><P d="M47 181 Q159 200 274 181" c="softline"/></g>}
function Mat(){return <g data-scene-part="mat"><P d="M59 196 Q160 184 267 199 L285 217 Q154 238 37 218 Z" c="light"/><P d="M55 217 Q160 231 271 215" c="softline"/></g>}
function Cushion(){return <g data-scene-part="cushion"><P d="M103 191 Q86 182 91 206 Q151 231 230 209 Q244 191 224 188 Q165 204 103 191Z" c="light"/><P d="M106 209 Q165 218 219 207" c="softline"/></g>}
function SideTable(){return <g data-scene-part="side-table"><P d="M222 184 L222 220 M266 184 L266 218"/><E x={244} y={184} rx={30} ry={10} c="table"/><E x={244} y={182} rx={22} ry={4} c="paper"/></g>}
function Steam({x, y, amount = 1, driftLeft = false}: {x: number; y: number; amount?: number; driftLeft?: boolean}) {
  const curls = driftLeft
    ? ['M0 0 C-7 -8 -18 -6 -19 -16 S-33 -23 -30 -33']
    : ['M0 0 C12 -9 -9 -17 1 -28', 'M13 0 C27 -13 3 -22 15 -37', 'M-12 1 C0 -12 -22 -23 -9 -43']
  return <g data-scene-part="steam" transform={`translate(${x} ${y})`} className="scene-rig-steam">
    {curls.map((d,i) => <P key={d} d={d} c="steam" opacity={clamp(amount-i)*.7}/>)}
  </g>
}
function Cup({frame}:{frame:ScenePoseFrame}){const c=frame.cup;return <g data-scene-part="cup" data-held={c.held>.99} transform={`translate(${c.x} ${c.y}) rotate(${c.angle}) scale(${c.scale})`}><P d="M20 -18 C37 -21 38 -3 21 -4 L21 -9 C31 -7 31 -17 21 -14" c="paper"/><P d="M-18 -21 L23 -21 L20 -3 Q1 7 -14 -3 Z" c="paper"/><E x={2} y={-21} rx={20} ry={4} c="paper"/><E x={2} y={-21} rx={18} ry={3} c="edge" opacity={c.liquid}/></g>}
function Kettle({frame}:{frame:ScenePoseFrame}){const k=frame.kettle;return <g data-scene-part="kettle" transform={`translate(${k.x} ${k.y}) rotate(${k.angle})`}><P d="M-17 -29 C-28 -49 28 -49 17 -29" c="handle"/><P d="M15 -28 L32 -36 L36 -27 L20 -13Z" c="green"/><P d="M-19 -29 Q-27 -16 -20 -3 Q0 6 21 -3 Q27 -18 18 -29 Z" c="green"/><P d="M-20 -29 Q0 -40 20 -29Z" c="green"/><R x={-4} y={-37} w={8} h={5} c="edge"/></g>}
function FoodDish({x,y,kind,detail}:{x:number;y:number;kind:'greens'|'rice'|'soup';detail:number}) {
  const d=clamp(detail),riceHeight=.08+.92*d
  return <g data-scene-part={`dish-${kind}`} data-prepared={d} transform={`translate(${x} ${y})`}>
    <E x={0} y={1} rx={25} ry={4}/>
    {kind==='rice'?<>
      <E x={0} y={-1} rx={30} ry={7} c="paper"/><E x={0} y={-2} rx={24} ry={4} c="edge"/>
      <g data-scene-part="rice-ingredients" opacity={1-d}>
        <E x={-11} y={-6} rx={5} ry={2.5} c="paper"/><E x={1} y={-7} rx={6} ry={3} c="paper"/><E x={12} y={-5} rx={4} ry={2} c="paper"/>
      </g>
      <g data-scene-part="plated-rice" transform={`translate(0 -3) scale(1 ${riceHeight})`}>
        <P d="M-20 0 Q-19 -9 -11 -10 Q-8 -18 0 -15 Q10 -19 13 -10 Q21 -8 21 0 Z" c="paper"/>
        <P d="M-10 -6 l3 1 m4 -6 l3 1 m6 5 l3 -1 m-12 5 l3 1" c="softline" opacity={d}/>
        <P d="M-4 -15 Q-8 -23 2 -21 Q6 -18 3 -14 Z" c="green" opacity={stage(d,.7,1)}/>
      </g>
    </>:<>
      <P d="M-24 -12 L24 -12 Q21 4 0 5 Q-21 4 -24 -12 Z" c="paper"/><E x={0} y={-12} rx={24} ry={6} c="paper"/>
      {kind==='greens'?<>
        <P d={`M-18 -13 Q-24 ${-29+6*d} -13 ${-27+5*d} Q-12 ${-37+10*d} -4 ${-28+5*d} Q5 ${-36+10*d} 9 ${-26+5*d} Q20 ${-30+6*d} 20 -16 Q9 -8 -18 -13 Z`} c="green"/>
        <P d={`M-10 ${-27+6*d} L-5 -14 M8 ${-28+6*d} L6 -14`} c="softline"/>
        <E x={-11} y={-13} rx={5*d} ry={4*d} c="pink"/><E x={10} y={-16} rx={5*d} ry={4*d} c="pink"/>
      </>:<>
        <E x={0} y={-4-8*d} rx={12+9*d} ry={2+2.5*d} c="edge"/>
        <E x={-7} y={-5-8*d} rx={4*d} ry={2*d} c="green"/><E x={7} y={-3-8*d} rx={3*d} ry={1.8*d} c="green"/>
      </>}
    </>}
  </g>
}
function FoodSpoon({grip,tip,held,name}:{grip:{x:number;y:number};tip:{x:number;y:number};held:number;name:string}) {
  const angle=Math.atan2(tip.y-grip.y,tip.x-grip.x)*180/Math.PI
  return <g data-scene-part={name} data-held={held>.999} transform={`translate(${grip.x} ${grip.y}) rotate(${angle})`}>
    <P d="M-3 0 L22 0" c="handle"/><E x={26} y={0} rx={6} ry={3} c="paper"/>
  </g>
}
function Book({frame}:{frame:ScenePoseFrame}){
  const { close, turn, corner, coverEdge, coverFront, ribbon } = frame.book
  const { x, y } = coverEdge
  const midX = (160+x)/2, midY = (169+y)/2
  const cover = `M160 169 Q${midX} ${midY-2} ${x} ${y} L${coverFront.x} ${coverFront.y} Q${midX+8} ${midY+12} 168 183 Z`
  const outerCover = stage(close,.44,.55)
  return <g data-scene-part="book">
    <P d="M114 161 L160 169 L168 183 L168 186 L122 178 L114 164 Z" c="green"/>
    <P d="M114 161 Q137 159 160 169 L168 183 Q144 173 122 175 Z" c="paper"/>
    {[0,1].map(i=><P key={i} d={`M${123+2*i} ${165+i*4} Q139 ${164+i*4} ${154+2*i} ${170+i*4}`} c="softline"/>)}
    <P d={cover} c="paper"/>
    <g opacity={1-outerCover}>
      {[0,1].map(i=><P key={i} d={`M${162+(x-160)*.15+2*i} ${172+i*4+(y-161)*.15} Q${midX+3} ${midY+1+i*4} ${163+(x-160)*.83+2*i} ${y+4+i*4}`} c="softline"/>)}
    </g>
    <P d={`M160 169 Q${(160+corner.x)/2} ${corner.y-4} ${corner.x} ${corner.y} l8 14 Q${(160+corner.x)/2+8} ${corner.y+12} 168 183 Z`} c="paper" opacity={Math.sin(turn*Math.PI)*(1-close)}/>
    <g transform={`translate(${midX} ${midY})`} opacity={ribbon}>
      <P d="M-3 0 L3 -1 L12 19 L8 17 L6 20Z" c="pink"/>
    </g>
    <P d={cover} c="green" opacity={outerCover}/>
    <P d={`M${160+(x-160)*.13} ${169+(y-169)*.13} l8 14`} c="softline" opacity={outerCover}/>
  </g>
}
function Boat({frame}:{frame:ScenePoseFrame}){const p=frame.boat.fold,f1=stage(p,.12,.39),f2=stage(p,.43,.73);const dx=frame.boat.x-160,dy=frame.boat.y;const topX=173-9*f1,topY=157-12*f1+10*f2;return <g data-scene-part="paper-boat"><g data-scene-part="water-tray"><E x={242} y={180} rx={39} ry={11} c="edge"/><E x={242} y={178} rx={35} ry={8} c="water"/></g><g transform={`translate(${dx} ${dy}) translate(160 180) scale(${frame.boat.scale}) translate(-160 -180)`}><P d={`M${112+7*f1} ${169+8*f1} L${topX} ${topY} L${210-5*f1+3*f2} ${178-f1} L${146-8*f1} ${191-3*f1} Z`} c="paper"/><P d={`M${134+30*f1} ${167-22*f1+10*f2} L${190-26*f1} ${180+f2} M${119} 177 L164 181 L208 177`} c="softline"/><P d={`M${119+10*f2} 177 L${208-9*f2} 177 L${189-6*f2} 188 L${138+7*f2} 188 Z`} c="paper" opacity={f2}/><P d="M145 177 L164 153 L183 177Z" c="paper" opacity={f2}/><P d="M164 154 L164 178" c="softline" opacity={f2}/></g></g>}
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
function Cloud({x,y,scale=1}:{x:number;y:number;scale?:number}){return <g transform={`translate(${x} ${y}) scale(${scale})`} className="scene-rig-cloud"><P d="M-31 8 C-48 7 -44 -10 -31 -9 C-29 -31 -8 -30 -1 -15 C13 -24 29 -15 27 -2 C48 -5 47 13 31 13 L-29 13Z" c="paper"/></g>}
function Body({frame, happy}: {frame: ScenePoseFrame; happy: boolean}) {
  const part = (name: string, color: string) => {
    const art = blueCompanionSpec.parts[name]
    return art && <g data-part={name}><P d={art.d} c={color}/></g>
  }
  const restingEyes = frame.id === 'R1' || frame.id === 'R3'
  return <g transform={`translate(${frame.body.x} ${frame.body.y})`} data-scene-part="creature">
    <E x={120} y={169} rx={54} ry={5}/>
    {part('footLeft','shade')}{part('footRight','shade')}
    <g className="scene-rig-breath">
      {part('tuft','body')}{part('body','body')}{part('shine','highlight')}{part('belly','belly')}
      {part('cheekLeft','pink')}{part('cheekRight','pink')}
      <g className="scene-rig-gaze" transform={`translate(${frame.gaze.x} ${frame.gaze.y})`}>
        <g className="scene-rig-eyes">
          {happy || frame.touched ? part('eyesHappy','face') : restingEyes ? part('eyesResting','face') : <>
            {part('eyeLeft','ink')}{part('eyeRight','ink')}{part('eyeShineLeft','glint')}{part('eyeShineRight','glint')}
          </>}
        </g>
      </g>
      {frame.id === 'F5' ? <>
        <g opacity={1-frame.wand.breath}>{part('mouth','face')}</g>
        <ellipse cx="122" cy="110" rx="3" ry="2.2" className="scene-draw-ink" opacity={frame.wand.breath}/>
      </> : part('mouth','face')}
    </g>
  </g>
}
interface Props { scene: CompanionScene; frame?: ScenePoseFrame }
/** Full persistent scene, with hand and prop geometry sampled from one pose. */
export function CompanionSceneArt({scene,frame:provided}:Props){
  const paint = useId().replace(/:/g, '')
  const material = { '--scene-coat': `url(#${paint}-body)`, '--scene-belly': `url(#${paint}-belly)` } as CSSProperties
  const f=provided??sampleScenePose({id:scene.id,status:scene.status,progress:scene.completedProgress,staticOnly:true});const id=scene.id,p=f.progress;const lean=`rotate(${f.body.lean} ${f.body.x+120} ${f.body.y+160})`
  let back:ReactNode=null,objects:ReactNode=null,held:ReactNode=null
  const usesTable=['F1','F2','F3','F6'].includes(id)
  if(id==='F1')objects=<>
    <FoodDish x={100} y={177} kind="greens" detail={f.food.greens}/><FoodDish x={162} y={188} kind="rice" detail={f.food.rice}/><FoodDish x={225} y={177} kind="soup" detail={f.food.soup}/>
    <g data-scene-part="utensil-rests"><R x={103} y={190} w={29} h={5} c="edge" r={2}/><R x={220} y={190} w={31} h={5} c="edge" r={2}/></g>
    <FoodSpoon grip={f.food.spoon} tip={f.food.tip} held={f.food.leftHeld} name="serving-spoon"/><FoodSpoon grip={f.food.soupSpoon} tip={f.food.soupTip} held={f.food.rightHeld} name="soup-spoon"/>
    <Steam x={225} y={155} amount={f.food.soup*1.4}/>
  </>
  if(id==='F2'){const h=13+42*p;objects=<><E x={92} y={180} rx={32} ry={5} c="edge"/><g data-scene-part="plant"><P d="M68 144 L116 144 L110 174 Q92 182 74 174Z" c="table"/><E x={92} y={144} rx={26} ry={6} c="edge"/><P d={`M92 143 Q95 ${141-h/2} 91 ${143-h}`}/><P d={`M92 ${139-h*.3} Q67 ${134-h*.7} 70 ${128-h*.7} Q91 ${125-h*.5} 92 ${139-h*.3} Z M92 ${135-h*.6} Q113 ${127-h} 118 ${132-h} Q116 ${147-h*.5} 92 ${135-h*.6} Z`} c="green"/><g transform={`translate(91 ${143-h}) scale(${.3+.7*stage(p,.7,1)})`}>{[-1,1].map(n=><E key={n} x={n*9} y={0} rx={8} ry={9} c="pink" opacity={stage(p,.6,.9)}/>)}<E x={0} y={-9} rx={8} ry={9} c="pink" opacity={stage(p,.6,.9)}/><E x={0} y={9} rx={8} ry={9} c="pink" opacity={stage(p,.6,.9)}/><E x={0} y={0} rx={5} ry={5} c="edge" opacity={stage(p,.6,.9)}/></g></g></>}
  if(id==='F3')objects=<Book frame={f}/>
  if(id==='F4'){objects=<><E x={131} y={183} rx={26} ry={4} c="edge"/><E x={169} y={183} rx={20} ry={4} c="paper"/><Kettle frame={f}/><Steam x={f.kettle.x} y={f.kettle.y-38} amount={.5+2.5*p}/><P d={`M${f.kettle.spout.x} ${f.kettle.spout.y} Q${f.cup.x-9} ${f.kettle.spout.y+12} ${169} ${165}`} c="pour" opacity={f.kettle.pour}/></>;held=<><Cup frame={f}/><Steam x={f.cup.x} y={f.cup.y-17} amount={f.cup.liquid*(.6+f.cup.held*.5)}/></>}
  if(id==='F5')objects=<Bubbles frame={f}/>
  if(id==='F6')objects=<Boat frame={f}/>
  if(id==='F7')objects=<g data-scene-part="block-inventory">{f.blocks.map((b,i)=><g key={i} data-block={i}><Block {...b} c={['green','table','light','green'][i]??'green'}/></g>)}<E x={132} y={214} rx={5} ry={2} c="edge"/><g data-scene-part="flag" transform={`translate(${f.flag.x} ${f.flag.y}) rotate(${f.flag.angle})`}><P d="M0 0 L0 -24"/><path className="scene-draw-pink" d="M0 -24 L16 -18 L0 -12Z" stroke="var(--scene-line)" strokeWidth="1.4"/></g></g>
  if(id==='F8')back=<g data-scene-part="sky"><P d="M44 42 C19 49 28 75 49 70 C30 67 32 49 44 42Z" c="paper"/>{[[260,44],[75,31],[285,105],[224,23],[36,116],[252,85]].map(([x=0,y=0],i)=><g className="scene-rig-star" key={i}><Star x={x} y={y} opacity={i<2?1:stage(p,(i-2)*.17,.2+(i-2)*.17)}/></g>)}<P d="M260 44 L252 85 L285 105" c="softline" opacity={stage(p,.3,.6)}/><g opacity={stage(p,.92,1)}><P d="M211 32 L174 51 M214 37 L187 53" c="softline"/><Star x={216} y={31} r={7}/></g></g>
  if(id==='R2')back=<g data-scene-part="clouds"><Cloud x={63} y={58} scale={.67}/><Cloud x={252} y={91} scale={.5}/></g>
  if(id==='R3'){objects=<SideTable/>;held=<><Cup frame={f}/><Steam x={f.cup.x-13} y={f.cup.y-18} amount={1} driftLeft/></>}
  return <g className="scene-rig" style={material} transform="scale(.75)" data-scene-part={`scene-${id}`} data-pose-progress={f.progress} data-contact-count={f.contacts.filter(c=>c.active).length} aria-hidden="true"><CompanionPaint id={paint}/><CompanionScenery scene={id}/><Ground/>{!usesTable&&id!=='F4'&&<Mat/>}{['F8','R2','R3'].includes(id)&&<Cushion/>}{back}<g transform={lean}><Body frame={f} happy={scene.status==='ended'||p===1}/></g>{usesTable&&<Table/>}{id==='F4'&&<Table tea/>}{objects}<g transform={lean} data-scene-part="arms"><path className="scene-draw-body" data-scene-hand="left" d={sceneArmPath(f.left)}/><path className="scene-draw-body" data-scene-hand="right" d={sceneArmPath(f.right)}/></g>{held}{f.contacts.map(c=><g key={c.name} data-scene-contact={c.name} data-contact-active={c.active} data-hand-x={c.hand.x} data-hand-y={c.hand.y} data-prop-x={c.prop.x} data-prop-y={c.prop.y}/>)}</g>
}
