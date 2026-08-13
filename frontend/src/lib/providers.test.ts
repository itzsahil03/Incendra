import { describe, it, expect } from 'vitest'
import { PROVIDERS, PROVIDER_INFO, providerInfo } from './providers'

describe('PROVIDER_INFO', () => {
  it('has an entry for every declared provider, keyed consistently', () => {
    for (const p of PROVIDERS) {
      expect(PROVIDER_INFO[p]).toBeDefined()
    }
    expect(Object.keys(PROVIDER_INFO).sort()).toEqual([...PROVIDERS].sort())
  })

  it('every entry has a non-empty displayName, color, and description', () => {
    for (const p of PROVIDERS) {
      const info = PROVIDER_INFO[p]
      expect(info.displayName.length).toBeGreaterThan(0)
      expect(info.color).toMatch(/^#|^rgba?\(/)
      expect(info.description.length).toBeGreaterThan(0)
    }
  })
})

describe('providerInfo', () => {
  it('returns the matching entry for a known provider', () => {
    expect(providerInfo('SLACK')).toBe(PROVIDER_INFO.SLACK)
    expect(providerInfo('DATADOG')).toBe(PROVIDER_INFO.DATADOG)
  })

  it('falls back to GENERIC for null', () => {
    expect(providerInfo(null)).toBe(PROVIDER_INFO.GENERIC)
  })

  it('falls back to GENERIC for undefined', () => {
    expect(providerInfo(undefined)).toBe(PROVIDER_INFO.GENERIC)
  })

  it('falls back to GENERIC for an unrecognized string', () => {
    expect(providerInfo('NOT_A_REAL_PROVIDER')).toBe(PROVIDER_INFO.GENERIC)
  })

  it('falls back to GENERIC for an empty string', () => {
    expect(providerInfo('')).toBe(PROVIDER_INFO.GENERIC)
  })
})
