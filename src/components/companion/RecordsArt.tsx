import { memo, useId } from 'react'
import { blueCompanionSpec } from '../../data/blue-companion'
import type { RecordsBand } from '../../logic/record-stories'
import { ScenePart } from './CompanionSceneArt'
import { CompanionPaint } from './CompanionPaint'
import '../../styles/records-art.css'

const roomColors = {
  morning:   { wall: '#f6e7c9', sky: '#c7e3df', horizon: '#fff1c5', hill: '#a4c4a8', trees: '#86ad92', wood: '#d3ae87' },
  afternoon: { wall: '#fbedd4', sky: '#a9dae7', horizon: '#f6f2c9', hill: '#b6ca99', trees: '#85ac91', wood: '#d5b28e' },
  evening:   { wall: '#f3d2b1', sky: '#e7b4aa', horizon: '#ffe1a1', hill: '#bbad99', trees: '#949e8c', wood: '#c89779' },
  night:     { wall: '#a6acbf', sky: '#536482', horizon: '#94a2b8', hill: '#8393a5', trees: '#687d91', wood: '#aa968d' },
}

function PressedLeaf() {
  return <g strokeLinecap="round" strokeLinejoin="round">
    <path d="M-4 7C-11 3-12-6 8-14C11-2 8 7-4 7Z" fill="#e8b867" stroke="#926d44" strokeWidth="1.25"/>
    <path d="M-7 12Q-3 4 6-10M-3 5L-7-1M0 1L6 0M2-3L0-7" fill="none" stroke="#906b42" strokeWidth="1.15"/>
  </g>
}

function OpenBook() {
  return <>{['bookLeft', 'bookRight', 'bookCover', 'bookLines', 'bookmark'].map(name => <ScenePart key={name} name={name}/>)}</>
}

/** Keep the Focus silhouette, coat gradients and expressions at their native coordinates. */
function Creature({ paint, pose }: { paint: string; pose: RecordsBand }) {
  const { parts, palette, outlineWidth } = blueCompanionSpec
  const color = (tone?: string) => tone === 'body' || tone === 'belly'
    ? `url(#${paint}-${tone})` : tone ? palette[tone] : 'none'
  const part = (name: string) => {
    const shape = parts[name]
    return shape && <path key={name} d={shape.d} fill={color(shape.fill)} stroke={color(shape.stroke)} strokeWidth={shape.width ?? outlineWidth}/>
  }
  const leaf = pose === 'evening'
  const lookX = leaf ? 5 : pose === 'afternoon' || pose === 'morning' ? -5 : 0
  return <g strokeLinecap="round" strokeLinejoin="round">
    {['footLeft','footRight','tuft','body','shine','belly','bellyDimple','cheekLeft','cheekRight'].map(part)}
    <g transform={`translate(${lookX} ${pose === 'night' ? 3 : 0})`}>
      <g className="records-art__gaze">
        {part('eyeLeft')}{part('eyeShineLeft')}
        {part('eyeRight')}{part('eyeShineRight')}
      </g>
    </g>
    {part('mouth')}
    {leaf ? <>
      {part('armLeftPaused')}
      <g className="records-art__leaf-hand">
        <g transform="translate(170 81) rotate(26) scale(1.55)"><PressedLeaf/></g>
        <path d="M168 107Q164 98 164 94Q163 87 158 88C151 91 151 103 158 112Q165 117 170 111" fill={palette.body} stroke={palette.outline} strokeWidth="1.5"/>
      </g>
    </> : pose === 'night' ? <g className="records-art__book-hands">
      <g transform="translate(81 121) scale(1.08 .92)"><OpenBook/></g>
      {part('armLeftPaused')}{part('armRightPaused')}
    </g> : <>
      <g className="records-art__curtain-hand">{part('armLeft')}</g>
      {part('armRight')}
    </>}
  </g>
}

function Window({ band, id }: { band: RecordsBand; id: string }) {
  const colors = roomColors[band]
  const opening = 'M14 87V49C14 24 37 12 63 12S113 25 113 49V87Z'
  return <g strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <clipPath id={`${id}-window`}><path d={opening}/></clipPath>
      <linearGradient id={`${id}-sky`} x2="0" y2="1">
        <stop stopColor={colors.sky}/><stop offset="1" stopColor={colors.horizon}/>
      </linearGradient>
    </defs>
    <path d={opening} fill={`url(#${id}-sky)`} stroke={colors.wood} strokeWidth="6"/>
    <g clipPath={`url(#${id}-window)`}>
      {band === 'night' ? <g fill="#f9eaca">
        <path d="M44 20C32 21 31 36 42 38Q51 40 56 30C47 34 40 28 44 20Z"/>
        <circle cx="82" cy="30" r="1.4"/><circle cx="24" cy="42" r="1"/><circle cx="87" cy="48" r=".8"/>
      </g> : <circle cx={band === 'evening' ? 38 : 80} cy={band === 'evening' ? 62 : 34} r="9" fill="#fff1c1"/>}
      <path d="M8 69Q33 49 61 62T117 58V90H8Z" fill={colors.hill}/>
      <path d="M8 80Q24 65 45 71Q58 72 64 77Q80 65 94 68Q107 61 121 70V91H8Z" fill={colors.trees}/>
      {band !== 'night' && <g fill="#e6b390"><circle cx="35" cy="74" r="1.6"/><circle cx="48" cy="76" r="1.2"/><circle cx="97" cy="72" r="1.6"/></g>}
      <path d="M64 10V90M12 55H116" stroke={colors.wood} strokeWidth="2.8"/>
      <g className="records-art__curtain">
        <path d="M89 10Q96 33 103 45Q100 65 102 86Q108 89 114 83L117 13Z" fill={band === 'night' ? '#8e8494' : '#d6a496'}/>
        <path d="M98 22Q100 35 107 44M108 50Q104 66 106 78" fill="none" stroke={band === 'night' ? '#807986' : '#bc8c80'} strokeWidth="1.3"/>
        <path d="M102 46L115 43" stroke="#efd0a4" strokeWidth="2"/>
      </g>
    </g>
    <path d="M10 87H115V91Q64 94 10 91Z" fill={colors.wood} stroke={colors.wood} strokeWidth="1.3"/>
  </g>
}

function ReadingLamp({ id }: { id: string }) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs>
      <radialGradient id={`${id}-lamp`}>
        <stop stopColor="#ffe4a1" stopOpacity=".84"/><stop offset="1" stopColor="#ffe4a1" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <path d="M185 42L116 109Q145 120 188 111L207 47Z" fill="#ffe8af" opacity=".2"/>
    <ellipse cx="155" cy="109" rx="52" ry="9" fill={`url(#${id}-lamp)`}/>
    <path d="M222 106L230 70L216 37L204 37" fill="none" stroke="#726e75" strokeWidth="3.8"/>
    <path d="M221 104Q231 102 235 109Q227 112 214 109Q214 106 221 104Z" fill="#8f8580" stroke="#716d70" strokeWidth="1.2"/>
    <path d="M190 30Q197 24 203 29L211 44Q200 48 184 44Z" fill="#d8a16e" stroke="#8d776b" strokeWidth="1.35"/>
    <path d="M186 44Q196 46 209 44" fill="none" stroke="#ffedbd" strokeWidth="2.5"/>
  </g>
}

/** The room preview is still: Records opens often, so it shows the settled frame. */
export const RecordsGreetingArt = memo(function RecordsGreetingArt({ band }: { band: RecordsBand }) {
  const id = `records-room-${useId().replace(/:/g, '')}`
  const colors = roomColors[band]
  return <svg className="records-art records-art--greeting" data-band={band} viewBox="0 0 250 128" aria-hidden="true" focusable="false">
    <CompanionPaint id={id}/>
    <rect width="250" height="128" rx="15" fill={colors.wall}/>
    <path d="M0 105Q109 101 250 103V113Q250 128 235 128H15Q0 128 0 113Z" fill={colors.wood}/>
    <path d="M10 116L42 115M198 121L236 120" stroke="#fff1cd" strokeOpacity=".4" strokeWidth="1.5" strokeLinecap="round"/>
    <Window band={band} id={id}/>
    {band === 'night' ? <ReadingLamp id={id}/> : <g opacity=".8">
      <path d="M209 63V49M210 55Q221 55 222 46Q212 44 210 55ZM208 52Q200 51 198 45Q206 44 208 52Z" fill="#91a28a" stroke="#91a28a" strokeWidth="1.4"/>
      <path d="M203 60H216L215 64Q224 75 214 77H205Q197 75 204 65Z" fill="#97b8af"/>
      <path d="M197 78H233" stroke="#b49377" strokeWidth="3" strokeLinecap="round"/>
    </g>}
    {band === 'afternoon' && <g transform="translate(89 44) scale(.64)"><g className="records-art__butterfly"><ScenePart name="butterfly"/></g></g>}
    <ellipse cx="147" cy="120" rx="41" ry="3.7" fill="#716f76" opacity=".17"/>
    <g transform="translate(67 7) scale(.67)">
      <g transform={band === 'afternoon' ? 'rotate(-5 120 165)' : undefined}><Creature paint={id} pose={band}/></g>
    </g>
  </svg>
})
