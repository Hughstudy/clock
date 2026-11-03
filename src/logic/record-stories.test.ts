import { describe, expect, it } from 'vitest'
import { recordsBand } from './record-stories'

describe('Records illustrations', () => {
  it('switches the greeting at each local-hour boundary', () => {
    expect([0, 5, 6, 11, 12, 16, 17, 20, 21, 23].map(recordsBand)).toEqual([
      'night', 'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
    ])
  })
})
