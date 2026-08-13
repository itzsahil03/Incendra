import { describe, it, expect } from 'vitest'
import { NAV_ITEMS } from './navItems'

describe('NAV_ITEMS', () => {
  it('includes the core workspace views', () => {
    const paths = NAV_ITEMS.map((i) => i.path)
    expect(paths).toEqual(['/app', '/app/incidents', '/app/alerts', '/app/activity', '/app/analytics', '/app/integrations'])
  })

  it('restricts Integrations to ADMIN', () => {
    const integrations = NAV_ITEMS.find((i) => i.path === '/app/integrations')
    expect(integrations?.allow).toEqual(['ADMIN'])
  })

  it('leaves the day-to-day views unrestricted', () => {
    const dashboard = NAV_ITEMS.find((i) => i.path === '/app')
    expect(dashboard?.allow).toBeUndefined()
  })
})
