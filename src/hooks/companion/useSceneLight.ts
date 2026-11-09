import { useMemo } from 'react'
import { SCENE_LIGHT } from '../../data/scene-light'
import { resolveSceneLight, type SceneLight } from '../../logic/daylight'

export type SceneSetting = keyof typeof SCENE_LIGHT
export type { SceneLight }

/** The light for one setting at a level of night (0 to 1). Null where no scenery is drawn. */
export function useSceneLight(setting: SceneSetting | null, night: number): SceneLight | null {
  return useMemo(() => setting ? resolveSceneLight(SCENE_LIGHT[setting], night) : null, [setting, night])
}
