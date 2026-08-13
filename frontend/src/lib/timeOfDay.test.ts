import { describe, it, expect } from 'vitest'
import { themeModeForTime } from './timeOfDay'

describe('themeModeForTime', () => {
  it('returns light at the start of the day boundary (6:00)', () => {
    expect(themeModeForTime(new Date(2026, 0, 1, 6, 0))).toBe('light')
  })

  it('returns light at midday', () => {
    expect(themeModeForTime(new Date(2026, 0, 1, 12, 0))).toBe('light')
  })

  it('returns light just before the evening boundary (17:59)', () => {
    expect(themeModeForTime(new Date(2026, 0, 1, 17, 59))).toBe('light')
  })

  it('returns dark exactly at the evening boundary (18:00)', () => {
    expect(themeModeForTime(new Date(2026, 0, 1, 18, 0))).toBe('dark')
  })

  it('returns dark at night', () => {
    expect(themeModeForTime(new Date(2026, 0, 1, 23, 0))).toBe('dark')
  })

  it('returns dark just before the morning boundary (5:59)', () => {
    expect(themeModeForTime(new Date(2026, 0, 1, 5, 59))).toBe('dark')
  })

  it('defaults to the current time when no date is passed', () => {
    const result = themeModeForTime()
    expect(['light', 'dark']).toContain(result)
  })
})
