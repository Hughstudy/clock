import type { ReactNode } from 'react'
import type { CompanionScene } from '../../contracts/presentation'
import { blueCompanionSpec } from '../../data/blue-companion'
import { sceneArtPalette, sceneArtSketch } from '../../data/scene-art'
import { sampleScenePose, sceneArmPath, sceneSmooth, type ScenePoseFrame } from '../../logic/scene-pose'

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
function Steam({x,y,amount=1,direction=1}:{x:number;y:number;amount?:number;direction?:number}){return <g data-scene-part="steam" transform={`translate(${x} ${y}) scale(${direction} 1)`} className="scene-rig-steam">{['M0 0 C12 -9 -9 -17 1 -28','M13 0 C27 -13 3 -22 15 -37','M-12 1 C0 -12 -22 -23 -9 -43'].map((d,i)=><P key={d} d={d} c="steam" opacity={clamp(amount-i)*.7}/>)}</g>}
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
  const b=frame.book,c=b.close,turn=Math.sin(b.turn*Math.PI),x=b.corner.x,y=b.corner.y
  const closeX=160+44*Math.cos(c*Math.PI),closeY=157-30*Math.sin(c*Math.PI)
  const lerp=(a:number,z:number)=>a+(z-a)*c
  const cover=`M${lerp(160,126)} ${lerp(165,176)} Q${lerp((160+closeX)/2,150)} ${lerp(closeY-3,171)} ${lerp(closeX,181)} ${lerp(closeY,170)} L${lerp(closeX+2,199)} ${lerp(closeY+24,179)} Q${lerp((160+closeX)/2,171)} ${lerp(closeY+20,184)} ${lerp(160,143)} ${lerp(188,187)} Z`
  return <g data-scene-part="book"><P d="M112 158 L160 164 L208 156 L208 180 L160 188 L114 181Z" c="green" opacity={1-c}/><g opacity={1-c}><P d="M159 165 Q133 150 112 157 L115 180 Q140 175 160 188 Q179 174 206 178 L208 154 Q184 150 159 165Z" c="paper"/><P d="M160 165 L160 187"/>{[0,1,2].map(j=><P key={j} d={`M122 ${164+j*4} Q141 ${160+j*4} 153 ${171+j*4} M167 ${171+j*4} Q183 ${161+j*4} 198 ${162+j*4}`} c="softline"/>)}</g><P d={`M160 165 Q${(160+x)/2} ${y-6} ${x} ${y} L${x} ${y+24} Q${(160+x)/2} ${y+19} 160 188 Z`} c="paper" opacity={turn*(1-c)}/><P d="M185 155 L185 178 L181 175 L177 178 L177 156" c="pink" opacity={b.ribbon*(1-c)}/><P d="M126 176 L143 187 L199 179 L199 183 L143 191 L126 180Z" c="paper" opacity={c}/><P d={cover} c="green" opacity={c}/><P d="M144 189 L195 181" c="softline" opacity={c}/><P d="M177 183 L177 191 L173 188 L169 192 L169 185" c="pink" opacity={c}/></g>
}
function Boat({frame}:{frame:ScenePoseFrame}){const p=frame.boat.fold,f1=stage(p,.12,.39),f2=stage(p,.43,.73);const dx=frame.boat.x-160,dy=frame.boat.y;const topX=173-9*f1,topY=157-12*f1+10*f2;return <g data-scene-part="paper-boat"><g data-scene-part="water-tray"><E x={242} y={180} rx={39} ry={11} c="edge"/><E x={242} y={178} rx={35} ry={8} c="water"/></g><g transform={`translate(${dx} ${dy}) translate(160 180) scale(${frame.boat.scale}) translate(-160 -180)`}><P d={`M${112+7*f1} ${169+8*f1} L${topX} ${topY} L${210-5*f1+3*f2} ${178-f1} L${146-8*f1} ${191-3*f1} Z`} c="paper"/><P d={`M${134+30*f1} ${167-22*f1+10*f2} L${190-26*f1} ${180+f2} M${119} 177 L164 181 L208 177`} c="softline"/><P d={`M${119+10*f2} 177 L${208-9*f2} 177 L${189-6*f2} 188 L${138+7*f2} 188 Z`} c="paper" opacity={f2}/><P d="M145 177 L164 153 L183 177Z" c="paper" opacity={f2}/><P d="M164 154 L164 178" c="softline" opacity={f2}/></g></g>}
function Block({x,y,angle,c}:{x:number;y:number;angle:number;c:string}){return <g transform={`translate(${x} ${y}) rotate(${angle})`}><P d="M0 -22 L25 -22 L25 0 L0 0Z" c={c}/><P d="M0 -22 L7 -28 L31 -28 L25 -22 M25 -22 L31 -28 L31 -6 L25 0"/></g>}
function Star({x,y,r=5,opacity=1}:{x:number;y:number;r?:number;opacity?:number}){return <P d={`M${x} ${y-r} L${x+1.8} ${y-1.5} L${x+r} ${y} L${x+1.8} ${y+1.5} L${x} ${y+r} L${x-1.8} ${y+1.5} L${x-r} ${y} L${x-1.8} ${y-1.5}Z`} c="edge" opacity={opacity}/>}
function Cloud({x,y,scale=1}:{x:number;y:number;scale?:number}){return <g transform={`translate(${x} ${y}) scale(${scale})`} className="scene-rig-cloud"><P d="M-31 8 C-48 7 -44 -10 -31 -9 C-29 -31 -8 -30 -1 -15 C13 -24 29 -15 27 -2 C48 -5 47 13 31 13 L-29 13Z" c="paper"/></g>}
function Body({frame,happy}:{frame:ScenePoseFrame;happy:boolean}){const {x,y}=frame.body;const part=(name:string,c:string)=>{const data=blueCompanionSpec.parts[name];return data?<g key={name} data-part={name}><P d={data.d} c={c}/></g>:null};return <g transform={`translate(${x} ${y})`} data-scene-part="creature"><E x={120} y={169} rx={54} ry={5}/>{(['footLeft','footRight'] as const).map(n=>part(n,'shade'))}<g className="scene-rig-breath">{part('tuft','body')}{part('body','body')}{part('shine','belly')}{part('belly','belly')}{part('cheekLeft','pink')}{part('cheekRight','pink')}<g className="scene-rig-gaze" transform={`translate(${frame.gaze.x} ${frame.gaze.y})`}><g className="scene-rig-eyes">{happy||frame.touched?part('eyesHappy','face'):(frame.id==='R1'||frame.id==='R3')?part('eyesResting','face'):<>{part('eyeLeft','ink')}{part('eyeRight','ink')}</>}</g></g>{part('mouth','face')}</g></g>}
interface Props { scene: CompanionScene; frame?: ScenePoseFrame }
/** Full persistent scene, with hand and prop geometry sampled from one pose. */
export function CompanionSceneArt({scene,frame:provided}:Props){
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
  if(id==='F5')objects=<><P d="M172 150 Q186 145 197 145" c="softline" opacity={stage(p,.12,.2)*(1-stage(p,.6,.85))}/><P d="M174 154 Q186 152 195 149" c="softline" opacity={stage(p,.12,.2)*(1-stage(p,.6,.85))}/><E x={242} y={212} rx={21} ry={4}/><R x={226} y={178} w={32} h={33} c="green" r={7}/><E x={242} y={180} rx={16} ry={5} c="edge"/><g data-scene-part="wand" transform={`translate(${f.wand.x} ${f.wand.y}) rotate(${f.wand.angle})`}><P d="M0 -8 L0 18"/><E x={0} y={28} rx={10} ry={10} c="line"/></g>{[[264,84,20],[68,89,14],[238,42,10]].map(([x=0,y=0,r=0],i)=><g key={i} className="scene-rig-bubble" opacity={stage(p,.1+i*.22,.25+i*.22)}><E x={x} y={y} rx={r} ry={r} c="water"/><P d={`M${x-r*.6} ${y-r*.2} Q${x-r*.6} ${y-r*.65} ${x-r*.2} ${y-r*.7}`} c="softline"/></g>)}<P d="M264 80 C249 66 243 86 264 96 C285 86 279 66 264 80Z" c="pink" opacity={stage(p,.85,1)}/></>
  if(id==='F6')objects=<Boat frame={f}/>
  if(id==='F7')objects=<g data-scene-part="block-inventory">{f.blocks.map((b,i)=><g key={i} data-block={i}><Block {...b} c={['green','table','light','green'][i]??'green'}/></g>)}<g data-scene-part="flag" transform={`translate(${f.flag.x} ${f.flag.y}) rotate(${f.flag.angle})`}><P d="M0 0 L0 -22"/><P d="M0 -22 L22 -15 L0 -9Z" c="pink"/></g></g>
  if(id==='F8')back=<g data-scene-part="sky"><P d="M44 42 C19 49 28 75 49 70 C30 67 32 49 44 42Z" c="paper"/>{[[260,44],[75,31],[285,105],[224,23],[36,116],[252,85]].map(([x=0,y=0],i)=><g className="scene-rig-star" key={i}><Star x={x} y={y} opacity={i<2?1:stage(p,(i-2)*.17,.2+(i-2)*.17)}/></g>)}<P d="M260 44 L252 85 L285 105" c="softline" opacity={stage(p,.3,.6)}/><g opacity={stage(p,.92,1)}><P d="M211 32 L174 51 M214 37 L187 53" c="softline"/><Star x={216} y={31} r={7}/></g></g>
  if(id==='R2')back=<g data-scene-part="clouds"><Cloud x={63} y={58} scale={.67}/><Cloud x={252} y={91} scale={.5}/></g>
  if(id==='R3'){objects=<SideTable/>;held=<><Cup frame={f}/><Steam x={f.cup.x-13} y={f.cup.y-18} amount={1} direction={-1}/></>}
  return <g className="scene-rig" transform="scale(.75)" data-scene-part={`scene-${id}`} data-pose-progress={f.progress} data-contact-count={f.contacts.filter(c=>c.active).length} aria-hidden="true"><Ground/>{!usesTable&&id!=='F4'&&<Mat/>}{['F8','R2','R3'].includes(id)&&<Cushion/>}{back}<g transform={lean}><Body frame={f} happy={scene.status==='ended'||p===1}/></g>{usesTable&&<Table/>}{id==='F4'&&<Table tea/>}{objects}<g transform={lean} data-scene-part="arms"><path className="scene-draw-body" data-scene-hand="left" d={sceneArmPath(f.left)}/><path className="scene-draw-body" data-scene-hand="right" d={sceneArmPath(f.right)}/></g>{held}{f.contacts.map(c=><g key={c.name} data-scene-contact={c.name} data-contact-active={c.active} data-hand-x={c.hand.x} data-hand-y={c.hand.y} data-prop-x={c.prop.x} data-prop-y={c.prop.y}/>)}</g>
}
