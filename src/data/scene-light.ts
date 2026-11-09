import type { SceneLightPalette } from '../logic/daylight'

// Each setting's daylight colors are the original drawing. Twilight is the approved dusk palette.
const terraceDay = { far: '#c0d8bc', near: '#a5c8ae', hedge: '#87b298', leaf: '#b2cfa0', groundLine: '#b4b898', groundMark: '#c2b798' }
const terraceTwilight = { far: '#afb4cb', near: '#959fb6', hedge: '#7e90a5', leaf: '#9ba9bb', groundLine: '#a099aa', groundMark: '#aca3ae' }
const terraceNight = { far: '#4b5779', near: '#3f4c6e', hedge: '#344363', leaf: '#4e5f80', groundLine: '#4a4f6e', groundMark: '#515677' }
const viewDay = { viewSky: '#b9dcd7', viewFar: '#a6cbb8', viewNear: '#83b49c' }
const viewTwilight = { viewSky: '#c7a8ae', viewFar: '#9aa3b9', viewNear: '#7f8ca6' }
// The room's dimming also falls on the window, so these start lighter than they end up.
const viewNight = { viewSky: '#7b8fc2', viewFar: '#8596b8', viewNear: '#7585aa' }
const room = { washTop: '#f4dfc5', washBottom: '#fbedd4', floor: '#edcfaf' }

export const SCENE_LIGHT: Readonly<Record<'workroom' | 'garden', SceneLightPalette>> = {
  workroom: {
    stops: [
      { ...terraceDay, ...viewDay, ...room },
      { ...terraceTwilight, ...viewTwilight, ...room },
      { ...terraceNight, ...viewNight, ...room },
    ],
    dim: [0, 0.38, 0.72],
    dimTint: '#6b74a6',
  },
  garden: {
    stops: [
      { ...terraceDay, ...viewDay, washTop: '#c4dedc', washBottom: '#f4edd3', floor: '#dfd1ad' },
      { ...terraceTwilight, ...viewTwilight, washTop: '#858eaf', washBottom: '#d9bdba', floor: '#c2b5b6' },
      { ...terraceNight, ...viewNight, washTop: '#1c2850', washBottom: '#46527f', floor: '#5b5f80' },
    ],
    dim: [0, 0, 0],
    dimTint: '#6b74a6',
  },
}
