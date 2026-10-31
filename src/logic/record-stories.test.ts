import { describe, expect, it } from 'vitest'
import { recordsBand, recordStoryId } from './record-stories'

describe('Records illustrations', () => {
  it('uses stable v1 story IDs for native and older sessions', () => {
    expect(['one', 'two', 'legacy-42', '🌙'].map(recordStoryId)).toEqual(['leaf', 'map', 'star', 'leaf'])
  })

  it('switches the greeting at each local-hour boundary', () => {
    expect([0, 5, 6, 11, 12, 16, 17, 20, 21, 23].map(recordsBand)).toEqual([
      'night', 'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
    ])
  })
})
