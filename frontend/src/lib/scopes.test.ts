import { describe, it, expect } from 'vitest'
import { SCOPES, SCOPE_PRESETS, groupScopesByResource, matchingPresetLabel, capitalize } from './scopes'

describe('SCOPE_PRESETS', () => {
  it('the Read Only preset contains exactly the .read scopes', () => {
    const readOnly = SCOPE_PRESETS.find((p) => p.label === 'Read Only')!
    expect(readOnly.scopes.sort()).toEqual(SCOPES.filter((s) => s.endsWith('.read')).sort())
  })

  it('the Administrator preset contains every scope', () => {
    const admin = SCOPE_PRESETS.find((p) => p.label === 'Administrator')!
    expect(admin.scopes.sort()).toEqual([...SCOPES].sort())
  })
})

describe('groupScopesByResource', () => {
  it('groups actions under their resource', () => {
    expect(groupScopesByResource(['alerts.read', 'alerts.write', 'incidents.read'])).toEqual({
      alerts: ['read', 'write'],
      incidents: ['read'],
    })
  })

  it('returns an empty object for an empty list', () => {
    expect(groupScopesByResource([])).toEqual({})
  })

  it('skips malformed entries without a dot', () => {
    expect(groupScopesByResource(['malformed', 'alerts.read'])).toEqual({ alerts: ['read'] })
  })

  it('skips entries with an empty resource or action segment', () => {
    expect(groupScopesByResource(['.read', 'alerts.'])).toEqual({})
  })
})

describe('matchingPresetLabel', () => {
  it('matches a preset regardless of input order', () => {
    expect(matchingPresetLabel(['alerts.write', 'alerts.read'])).toBe('Monitoring')
  })

  it('matches the Administrator preset when all scopes are present', () => {
    expect(matchingPresetLabel([...SCOPES])).toBe('Administrator')
  })

  it('returns Custom for a combination matching no preset', () => {
    expect(matchingPresetLabel(['alerts.read', 'webhooks.write'])).toBe('Custom')
  })

  it('returns Custom for an empty scope list', () => {
    expect(matchingPresetLabel([])).toBe('Custom')
  })
})

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('read')).toBe('Read')
  })

  it('returns an empty string unchanged', () => {
    expect(capitalize('')).toBe('')
  })

  it('leaves an already-capitalized string\'s tail alone', () => {
    expect(capitalize('WRITE')).toBe('WRITE')
  })

  it('handles a single character', () => {
    expect(capitalize('a')).toBe('A')
  })
})
