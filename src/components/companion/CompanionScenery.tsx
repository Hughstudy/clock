import { memo, useId } from 'react'
import type { SceneId } from '../../contracts/presentation'

type Setting = 'workroom' | 'garden' | 'dusk'

// The same orchard is visible from the workroom and across the terrace.
function settingFor(scene?: SceneId): Setting {
  switch (scene) {
    case 'F8': return 'dusk'
    case 'F2': case 'F5': case 'F6': case 'R1': case 'R2': return 'garden'
    default: return 'workroom'
  }
}

function Workroom() {
  return <>
    {/* Recessed arched window with two hills visible through the glass. */}
    <path fill="#d8bc9f" d="M13 129V72C13 44 34 26 61 26S109 45 109 71V129Z"/>
    <path fill="#f9e4be" d="M16 126V71C16 46 36 29 61 29S106 47 106 71V126Z"/>
    <path fill="#b9dcd7" d="M21 121V72C21 49 38 35 61 35S101 51 101 72V121Z"/>
    <circle cx="77" cy="60" r="11" fill="#fff0c2"/>
    <path d="M21 89Q44 68 64 83T101 81V121H21Z" fill="#a6cbb8"/>
    <path d="M21 104Q36 88 54 96Q77 105 101 89V121H21Z" fill="#83b49c"/>
    <path d="M24 109Q45 104 59 108M73 104Q84 100 95 99" stroke="#c2d9ad" strokeWidth="2" fill="none"/>
    <path d="M60 35V123M21 83H101" stroke="#f6dfb9" strokeWidth="4"/>
    <path d="M17 47Q31 33 51 31Q43 59 28 77L31 115Q23 120 16 114Z" fill="#dcad9e"/>
    <path d="M25 49Q26 63 22 74M19 80L20 108" stroke="#c79386" strokeWidth="1.6" fill="none"/>
    <path d="M17 77L29 75" stroke="#f9dba4" strokeWidth="3"/>
    <path d="M12 123H112V128Q63 132 12 127Z" fill="#c3a387"/>
    <path d="M12 123H112" stroke="#f4d9ab" strokeWidth="3"/>

    {/* A shelf with linen-bound books and a small stoneware bottle. */}
    <path d="M240 101L242 109L247 102M285 100L287 108L291 101" fill="#c6ad97"/>
    <path d="M232 97Q261 96 299 97L297 102H234Z" fill="#b89a82"/>
    <path d="M235 96H297" stroke="#efd5ac" strokeWidth="2"/>
    <g stroke="#a68e7e" strokeWidth=".8">
      <rect x="239" y="76" width="6" height="20" rx="1.4" fill="#b6c6ba"/>
      <rect x="246" y="71" width="7" height="25" rx="1.4" fill="#d3aca1"/>
      <path d="M254 77L260 75L266 94L260 96Z" fill="#e7c694"/>
    </g>
    <path d="M247 77H252M247 90H252" stroke="#f3dbc0" strokeWidth="1.5"/>
    <path d="M279 81Q276 68 270 64M279 79Q281 68 286 66" fill="none" stroke="#91a694" strokeWidth="1.6"/>
    <path d="M274 69Q265 70 264 61Q272 60 274 69ZM281 73Q280 66 290 61Q292 70 281 73Z" fill="#a9bc9b"/>
    <path d="M274 80H283L282 84Q292 93 284 96H274Q267 93 275 84Z" fill="#9fbcb3"/>
    <path d="M274 80H283" stroke="#769c94" strokeWidth="1.5"/>

    <path fill="#edcfaf" d="M0 159Q152 161 320 157V240H0Z"/>
    <path d="M0 158Q150 161 320 156" fill="none" stroke="#ccb191" strokeWidth="2.5"/>
    <path d="M16 164L89 163L140 194L39 197Z" fill="#f7dfb7"/>
    <g fill="none" stroke="#d1b393" strokeWidth="1.1">
      <path d="M0 192Q31 191 51 192M276 184L320 183M0 216L30 216M265 216L320 215"/>
      <path d="M21 192L16 196M296 183L300 187"/>
    </g>
  </>
}

function Terrace({ dusk }: { dusk: boolean }) {
  const far = dusk ? '#afb4cb' : '#c0d8bc'
  const near = dusk ? '#959fb6' : '#a5c8ae'
  const hedge = dusk ? '#7e90a5' : '#87b298'
  const leaf = dusk ? '#9ba9bb' : '#b2cfa0'
  return <>
    {!dusk && <g fill="#fff2ce">
      <circle cx="254" cy="44" r="12"/>
      <path d="M89 49Q93 45 99 46Q105 38 114 43Q119 42 123 47Q129 46 134 50Z" opacity=".7"/>
    </g>}
    <path d="M0 122Q31 102 56 105Q86 108 116 96Q155 80 193 98Q224 110 256 93Q293 74 320 90V182H0Z" fill={far}/>
    <path d="M0 139Q38 117 65 121Q106 130 142 118Q183 103 222 119Q261 128 286 112Q302 102 320 105V183H0Z" fill={near}/>
    <path d="M0 142Q21 136 42 136M245 126Q260 127 276 120" stroke={leaf} strokeWidth="2" fill="none"/>
    <path d="M0 116Q9 105 15 113Q16 96 28 101Q39 101 39 117Q52 105 60 118Q66 127 59 141Q72 134 79 146Q83 153 80 162H0Z" fill={hedge}/>
    <path d="M320 106Q306 96 299 111Q288 103 280 116Q273 124 276 137Q259 125 252 141Q239 138 234 157H320Z" fill={hedge}/>
    <g fill={leaf}>
      <path d="M17 127Q15 117 11 116Q9 125 17 127ZM18 132Q24 123 28 125Q26 132 18 132ZM43 134Q41 125 36 124Q34 131 43 134Z"/>
      <path d="M289 129Q286 120 282 121Q282 128 289 129ZM291 136Q298 124 302 126Q301 135 291 136Z"/>
    </g>
    {!dusk && <g fill="#e8b497"><circle cx="24" cy="114" r="2.8"/><circle cx="49" cy="126" r="2.5"/><circle cx="302" cy="117" r="2.7"/></g>}
    <path d="M0 155Q144 149 320 155V240H0Z" fill={dusk ? '#c2b5b6' : '#dfd1ad'}/>
    <path d="M0 157Q151 150 320 157" fill="none" stroke={dusk ? '#a099aa' : '#b4b898'} strokeWidth="2"/>
    <g fill="none" stroke={dusk ? '#aca3ae' : '#c2b798'} strokeWidth="1.2">
      <path d="M0 177L36 175M48 175L64 175M271 174L320 175M10 200L49 199M281 197L314 198"/>
      <path d="M30 175L26 182M296 198L299 205"/>
    </g>
    <g fill={hedge}>
      <path d="M7 181Q8 173 10 170L11 178L15 174L13 181ZM302 178Q302 168 305 166L306 175L311 171L308 179Z"/>
    </g>
  </>
}

/** Stationary illustration, painted underneath the existing character and activity rig. */
export const CompanionScenery = memo(function CompanionScenery({ scene }: { scene?: SceneId }) {
  const setting = settingFor(scene)
  const id = useId().replace(/:/g, '')
  const clip = `scenery-${setting}-${id}`
  const wash = `${clip}-wash`
  const colors = setting === 'dusk' ? ['#858eaf', '#d9bdba']
    : setting === 'garden' ? ['#c4dedc', '#f4edd3'] : ['#f4dfc5', '#fbedd4']
  return <g data-scenery={setting} aria-hidden="true" pointerEvents="none" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <clipPath id={clip}><rect x="4" y="8" width="312" height="223" rx="28"/></clipPath>
      <linearGradient id={wash} x1="0" x2=".16" y1="0" y2="1">
        <stop stopColor={colors[0]}/><stop offset="1" stopColor={colors[1]}/>
      </linearGradient>
    </defs>
    <g clipPath={`url(#${clip})`}>
      <rect x="4" y="8" width="312" height="223" fill={`url(#${wash})`}/>
      {setting === 'workroom' ? <Workroom/> : <Terrace dusk={setting === 'dusk'}/>}
    </g>
  </g>
})
