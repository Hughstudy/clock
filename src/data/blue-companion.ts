import raw from './companion-spec.json'
import { validateBlueCompanionSpec } from '../logic/blue-companion'

export const blueCompanionSpec = validateBlueCompanionSpec(raw)
