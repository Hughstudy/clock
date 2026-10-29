import type { CompanionScene } from '../../contracts/presentation'
import { sceneArtPalette, sceneArtSketch } from '../../data/scene-art'

export function ScenePart({ name, className, transform }: { name: string; className?: string; transform?: string }) {
  return <g className={className} transform={transform} data-scene-part={name}>
    {sceneArtSketch.parts[name]?.paths.map((path, i) => <path key={i} d={path.d}
      fill={path.fill ? sceneArtPalette[path.fill] : 'none'} stroke={path.stroke ? sceneArtPalette[path.stroke] : undefined}
      strokeWidth={path.width} strokeLinecap="round" strokeLinejoin="round" />)}
  </g>
}

interface Props { scene: CompanionScene; layer: 'back' | 'held' | 'front' }

/** All props are decorative. Scene/ending truth comes only from the host. */
export function CompanionSceneArt({ scene, layer }: Props) {
  const { id, status, ending } = scene
  const ended = status === 'ended'
  const p = Math.max(0, Math.min(1, scene.completedProgress))
  const tier = ending?.tier ?? 'snack'
  const part = (name: string, className?: string, transform?: string) => <ScenePart name={name} {...(className ? { className } : {})} {...(transform ? { transform } : {})} />
  const cup = (x: number, y: number) => <g transform={`translate(${x} ${y})`} className="scene-cup">{part('cup')}{part('cupTea')}{part('steam', 'scene-steam', 'translate(5 -9) scale(.7)')}</g>

  if (layer === 'back') return <g className="scene-back" aria-hidden="true">
    {(id === 'R1' || id === 'R2' || id === 'F8') && part('cushion', undefined, 'translate(56 150)')}
    {(id === 'R2') && <g className="scene-cloud" transform="translate(18 54) scale(.64)">{part('cloud')}</g>}
    {id === 'F8' && <g className="scene-night">
      {part('moon', undefined, 'translate(36 51) scale(.68)')}
      {part('star', 'scene-star', 'translate(61 31) scale(.32)')}
      {part('star', 'scene-star scene-star--second', 'translate(23 85) scale(.3)')}
      {p > .3 && part('star', 'scene-star', 'translate(176 45) scale(.22)')}
      {p > .65 && part('star', 'scene-star scene-star--second', 'translate(204 79) scale(.32)')}
    </g>}
  </g>

  if (layer === 'held') return <g className="scene-held" aria-hidden="true">
    {id === 'F3' && <g transform="translate(84 119)" className="scene-book">
      {ended ? <>{part('closedBook')}{part('bookEdges')}{part('bookmark', undefined, 'translate(-10 4)')}</> : <>
        {part('bookLeft')}{part('bookRight')}{part('bookLines')}{part('bookPicture')}{part('bookCover')}
        <g className="scene-page">{part('bookRight')}</g>
      </>}
    </g>}
    {id === 'F6' && <g transform="translate(89 129) scale(.9)" className="scene-paper">
      {ended ? <>{part('puddle')}{part('boat', 'scene-boat')}{part('boatStripe', 'scene-boat')}</> : <>{part('paperFold')}{p > .5 && part('boat', undefined, 'translate(0 8) scale(.9)')}</>}
    </g>}
    {(id === 'R3' || (id === 'F4' && ended)) && cup(106, 124)}
    {id === 'F1' && ended && (tier === 'hello' ? part('spoon', 'scene-serving', 'translate(111 123) rotate(-26)') : <g className="scene-serving" transform="translate(103 124)">
      {part('bowl')}{part('bowlSoup')}{(tier === 'meal' || tier === 'feast') && part('steam', 'scene-steam', 'translate(7 -8) scale(.7)')}
      {tier === 'feast' && <g transform="translate(-31 9) scale(.72)">{part('bowl')}{part('bowlSoup')}</g>}
    </g>)}
  </g>

  return <g className="scene-front" aria-hidden="true">
    {id === 'F1' && <g transform="translate(17 108)" className="scene-pot">
      {part('potHandles')}{part('pot')}{part('soup')}{part('soupHerbs')}
      <g className="scene-lid">{part('potLid')}{part('lidKnob')}</g>
      {part('steam', 'scene-steam', 'translate(10 -12)')}
      {!ended && part('spoon', 'scene-spoon', 'translate(33 -15) rotate(18)')}
    </g>}
    {id === 'F2' && <g transform="translate(24 124)" className="scene-plant">
      <g transform={`translate(0 0) scale(1 ${ended ? 1 : .32 + p * .68})`}>
        {part('stem')}<g className="scene-leaves">{part('leaves')}</g>
        {(ended || p >= .85) && <g transform="translate(17 -43) scale(.7)" className="scene-flower">{part('flower')}{part('flowerMiddle')}</g>}
      </g>
      {part('plantPot')}{part('plantRim')}
      <g transform="translate(10 -58) scale(.45)" className="scene-butterfly">{part('butterfly')}</g>
    </g>}
    {id === 'F4' && <g transform="translate(22 111) scale(.85)" className="scene-tea">
      {part('teapot')}<g className="scene-lid">{part('teaLid')}</g>{part('steam', 'scene-steam', 'translate(12 -12) scale(.8)')}
      {ended && <g transform="translate(34 20) scale(.7)">{part('cup')}{part('cupTea')}</g>}
    </g>}
    {id === 'F5' && <>
      {part('wand', 'scene-wand', 'translate(190 77) rotate(-15)')}
      <g transform="translate(203 50) scale(.68)" className="scene-bubble">{part('bubble')}{part('bubbleShine')}</g>
      <g transform="translate(44 66) scale(.4)" className="scene-bubble scene-bubble--second">{part('bubble')}{part('bubbleShine')}</g>
      {ended && <g transform="translate(49 48) scale(.65)" className="scene-bubble-heart">{part('bubble')}{part('heart', undefined, 'translate(0 -2) scale(.4)')}</g>}
    </>}
    {id === 'F7' && <g transform="translate(25 128)" className="scene-blocks">
      {part('block')}{part('blockGold', undefined, 'translate(3 -18)')}
      {(p > .3 || ended) && part('blockBlue', undefined, 'translate(-1 -36)')}
      {(p > .7 || ended) && part('block', 'scene-block-top', 'translate(2 -54)')}
      {ended && part('flag', 'scene-flag', 'translate(12 -55)')}
    </g>}
    {id === 'F8' && ended && <g transform="translate(43 66) scale(.65)" className="scene-shooting-star">{part('star')}</g>}
    {id === 'R1' && <g className="scene-stretch-marks" fill="none" stroke={sceneArtPalette.ground} strokeWidth="2" strokeLinecap="round"><path d="M35 65l-4 -6m10 -1l-1 -7m164 14l5 -6m-11 -1l1 -7" /></g>}
    {id === 'R3' && part('steam', 'scene-steam', 'translate(111 110) scale(.8)')}
    {ended && scene.phase === 'focus' && (tier === 'meal' || tier === 'feast') && <g className="scene-ending-sparks">
      {part('star', undefined, 'translate(49 59) scale(.32)')}{part('star', undefined, 'translate(197 95) scale(.26)')}
      {tier === 'feast' && part('heart', undefined, 'translate(181 55) scale(.48)')}
    </g>}
  </g>
}
