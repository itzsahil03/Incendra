const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface Trend {
  pct: number | null
  isNew: boolean
  /** Overrides the trailing "vs last 7 days" wording — e.g. the Activity page computes its
   *  own trend server-side against a different comparison window and needs to say "vs
   *  yesterday" or "vs previous period" instead. */
  label?: string
}

/** Real, honest trend: items matching `predicate` timestamped in the last 7 days vs the
 *  7 days before that — computed from actual timestamps, not a fabricated percentage.
 *  Returns null when there's simply no data in either window. */
export function computeTrend<T>(list: T[], getTimestamp: (item: T) => string, predicate: (item: T) => boolean): Trend | null {
  const now = Date.now()
  let current = 0
  let prior = 0
  for (const item of list) {
    if (!predicate(item)) continue
    const age = now - new Date(getTimestamp(item)).getTime()
    if (age < ONE_WEEK_MS) current += 1
    else if (age < ONE_WEEK_MS * 2) prior += 1
  }
  if (current === 0 && prior === 0) return null
  if (prior === 0) return { pct: null, isNew: true }
  return { pct: Math.round(((current - prior) / prior) * 100), isNew: false }
}
