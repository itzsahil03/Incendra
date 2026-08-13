import { describe, it, expect } from 'vitest'
import { ALERT_DISPOSITIONS, DISPOSITION_LABELS, DISPOSITION_COLORS } from './alertDisposition'

describe('alertDisposition', () => {
  it('has a label for every disposition', () => {
    for (const d of ALERT_DISPOSITIONS) {
      expect(DISPOSITION_LABELS[d]).toBeTruthy()
    }
  })

  it('has a color for every disposition', () => {
    for (const d of ALERT_DISPOSITIONS) {
      expect(DISPOSITION_COLORS[d]).toBeTruthy()
    }
  })

  it('lists 7 dispositions with no duplicates', () => {
    expect(ALERT_DISPOSITIONS).toHaveLength(7)
    expect(new Set(ALERT_DISPOSITIONS).size).toBe(7)
  })

  it('LABELS and COLORS keys exactly match ALERT_DISPOSITIONS', () => {
    expect(Object.keys(DISPOSITION_LABELS).sort()).toEqual([...ALERT_DISPOSITIONS].sort())
    expect(Object.keys(DISPOSITION_COLORS).sort()).toEqual([...ALERT_DISPOSITIONS].sort())
  })
})
