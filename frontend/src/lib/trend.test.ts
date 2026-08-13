import { describe, it, expect, vi, afterEach } from 'vitest'
import { computeTrend } from './trend'

interface Item {
  ts: string
  match: boolean
}

describe('computeTrend', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when the list is empty', () => {
    expect(computeTrend<Item>([], (i) => i.ts, (i) => i.match)).toBeNull()
  })

  it('returns null when nothing matches the predicate', () => {
    const list: Item[] = [{ ts: new Date().toISOString(), match: false }]
    expect(computeTrend(list, (i) => i.ts, (i) => i.match)).toBeNull()
  })

  it('returns isNew:true when there is current-window data but none in the prior window', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const list: Item[] = [
      { ts: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), match: true },
      { ts: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), match: true },
    ]
    const result = computeTrend(list, (i) => i.ts, (i) => i.match)
    expect(result).toEqual({ pct: null, isNew: true })
  })

  it('computes a positive percentage change when current > prior', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000
    const list: Item[] = [
      // 2 in current window (< 1 week ago)
      { ts: new Date(now.getTime() - 1000).toISOString(), match: true },
      { ts: new Date(now.getTime() - 2000).toISOString(), match: true },
      // 1 in prior window (1-2 weeks ago)
      { ts: new Date(now.getTime() - ONE_WEEK - 1000).toISOString(), match: true },
    ]
    const result = computeTrend(list, (i) => i.ts, (i) => i.match)
    expect(result).toEqual({ pct: 100, isNew: false })
  })

  it('computes a negative percentage change when current < prior', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000
    const list: Item[] = [
      { ts: new Date(now.getTime() - 1000).toISOString(), match: true },
      { ts: new Date(now.getTime() - ONE_WEEK - 1000).toISOString(), match: true },
      { ts: new Date(now.getTime() - ONE_WEEK - 2000).toISOString(), match: true },
    ]
    const result = computeTrend(list, (i) => i.ts, (i) => i.match)
    expect(result).toEqual({ pct: -50, isNew: false })
  })

  it('ignores items older than 2 weeks and items that fail the predicate', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000
    const list: Item[] = [
      { ts: new Date(now.getTime() - 1000).toISOString(), match: true },
      { ts: new Date(now.getTime() - 3 * ONE_WEEK).toISOString(), match: true }, // too old, ignored
      { ts: new Date(now.getTime() - 1000).toISOString(), match: false }, // predicate fails, ignored
    ]
    const result = computeTrend(list, (i) => i.ts, (i) => i.match)
    // Only 1 current, 0 prior => isNew
    expect(result).toEqual({ pct: null, isNew: true })
  })
})
