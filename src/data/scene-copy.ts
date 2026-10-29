import type { FocusSceneId, SceneId } from '../logic/types'

/** Main-owned names; scene art never chooses announcements or claims acquisition. */
export const sceneNames: Record<SceneId, string> = {
  F1: '等汤时间', F2: '小花盆', F3: '一起读书', F4: '双人茶', F5: '吹泡泡',
  F6: '纸船', F7: '积木塔', F8: '看星星', R1: '伸个懒腰', R2: '看云', R3: '暖暖的饮品',
}

export const sceneNoticeDelayMs = 3000
export const sceneUnlockText = (sceneId: FocusSceneId): string => `伙伴有了新活动：${sceneNames[sceneId]}。以后会自动轮换出现。`
