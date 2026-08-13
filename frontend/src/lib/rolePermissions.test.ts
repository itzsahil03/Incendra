import { describe, it, expect } from 'vitest'
import { ROLE_DEFINITIONS } from './rolePermissions'

describe('ROLE_DEFINITIONS', () => {
  it('defines exactly ADMIN, RESPONDER, and VIEWER roles, in that order', () => {
    expect(ROLE_DEFINITIONS.map((r) => r.role)).toEqual(['ADMIN', 'RESPONDER', 'VIEWER'])
  })

  it('gives every role a label and a description', () => {
    for (const def of ROLE_DEFINITIONS) {
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
    }
  })

  it('gives ADMIN full access across every resource group', () => {
    const admin = ROLE_DEFINITIONS.find((r) => r.role === 'ADMIN')!
    for (const group of admin.groups) {
      for (const item of group.items) {
        expect(item.allowed).toBe(true)
      }
    }
  })

  it('denies VIEWER every write action but allows every view action', () => {
    const viewer = ROLE_DEFINITIONS.find((r) => r.role === 'VIEWER')!
    for (const group of viewer.groups) {
      for (const item of group.items) {
        if (item.label.startsWith('View')) {
          expect(item.allowed).toBe(true)
        } else {
          expect(item.allowed).toBe(false)
        }
      }
    }
  })

  it('denies RESPONDER member-management and integration actions but allows incident/alert actions', () => {
    const responder = ROLE_DEFINITIONS.find((r) => r.role === 'RESPONDER')!
    const incidents = responder.groups.find((g) => g.resource === 'Incidents')!
    for (const item of incidents.items) expect(item.allowed).toBe(true)

    const members = responder.groups.find((g) => g.resource === 'Members & Roles')!
    expect(members.items.find((i) => i.label === 'View members')!.allowed).toBe(true)
    expect(members.items.find((i) => i.label === 'Invite members')!.allowed).toBe(false)

    const integrations = responder.groups.find((g) => g.resource === 'Integrations')!
    for (const item of integrations.items) expect(item.allowed).toBe(false)
  })

  it('every role covers the same set of resource groups', () => {
    const resourceSets = ROLE_DEFINITIONS.map((r) => r.groups.map((g) => g.resource).sort())
    expect(resourceSets[0]).toEqual(resourceSets[1])
    expect(resourceSets[1]).toEqual(resourceSets[2])
  })
})
