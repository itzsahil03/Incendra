import { describe, it, expect } from 'vitest'
import dayjs from './dayjs'

describe('dayjs (with relativeTime plugin)', () => {
  it('formats a date', () => {
    expect(dayjs('2026-01-15T00:00:00Z').format('YYYY-MM-DD')).toBe('2026-01-15')
  })

  it('has the relativeTime plugin extended (fromNow is available)', () => {
    const fiveMinutesAgo = dayjs().subtract(5, 'minute')
    expect(fiveMinutesAgo.fromNow()).toMatch(/minutes? ago/)
  })
})
