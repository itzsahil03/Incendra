import { describe, it, expect } from 'vitest'
import { STATUS_DOT } from './statusColors'

describe('STATUS_DOT', () => {
  it('has a color for every known incident status', () => {
    for (const status of ['Open', 'Acknowledged', 'Work in Progress', 'Resolved', 'Closed', 'Cancelled']) {
      expect(STATUS_DOT[status]).toBeTruthy()
    }
  })

  it('is undefined for an unrecognized status', () => {
    expect(STATUS_DOT['NotAStatus']).toBeUndefined()
  })
})
