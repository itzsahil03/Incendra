import { describe, it, expect } from 'vitest'
import { PRIORITY_COLORS, priorityColor } from './priority'

describe('priorityColor', () => {
  it('returns the mapped color for each known priority', () => {
    expect(priorityColor('P1')).toBe(PRIORITY_COLORS.P1)
    expect(priorityColor('P2')).toBe(PRIORITY_COLORS.P2)
    expect(priorityColor('P3')).toBe(PRIORITY_COLORS.P3)
    expect(priorityColor('P4')).toBe(PRIORITY_COLORS.P4)
  })

  it('falls back to the P4 (neutral) color for an unrecognized priority string', () => {
    expect(priorityColor('P5')).toBe(PRIORITY_COLORS.P4)
    expect(priorityColor('')).toBe(PRIORITY_COLORS.P4)
    expect(priorityColor('critical')).toBe(PRIORITY_COLORS.P4)
  })
})
