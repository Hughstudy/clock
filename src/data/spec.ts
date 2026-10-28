import { parseSpec, type Spec } from '../logic/spec'
import raw from './pet-spec.json'

/** Validated tunables. A malformed data file fails loudly at startup and in tests. */
export const spec: Spec = parseSpec(raw)
