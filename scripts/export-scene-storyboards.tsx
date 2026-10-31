import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CompanionScene, SceneId } from '../src/contracts/presentation'
import { CompanionSceneArt } from '../src/components/companion/CompanionSceneArt'
import { sampleScenePose } from '../src/logic/scene-pose'

/** Export exactly the production pose geometry, without browser scheduling. */
export function renderStoryboardFrame(id: SceneId, progress: number, actionProgress = 0, actionKind: 'idle' | 'open' | 'beat' | 'ending' = 'idle', ended = false): string {
  const scene: CompanionScene = {
    key: `storyboard:${id}`, id, sessionId: `storyboard-${id}`, phase: id.startsWith('R') ? 'break' : 'focus',
    status: ended ? 'ended' : 'running', completedProgress: progress, allowBeats: false, cue: null, ending: null,
  }
  return renderToStaticMarkup(<CompanionSceneArt scene={scene} frame={sampleScenePose({ id, status: scene.status, progress, activityProgress: progress, actionProgress, actionKind, staticOnly: true })}/> )
}
