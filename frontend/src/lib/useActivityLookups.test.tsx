import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useActivityLookups } from './useActivityLookups'
import * as incidentsApi from '@/api/incidents'
import * as alertsApi from '@/api/alerts'
import * as usersApi from '@/api/users'
import type { IncidentResponse } from '@/api/incidents'
import type { AlertResponse } from '@/api/alerts'
import type { UserResponse } from '@/api/users'
import type { Page } from '@/api/types'

vi.mock('@/api/incidents', () => ({ listIncidents: vi.fn() }))
vi.mock('@/api/alerts', () => ({ listAlerts: vi.fn() }))
vi.mock('@/api/users', () => ({ listUsers: vi.fn() }))

function page<T>(content: T[]): Page<T> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 100, first: true, last: true, numberOfElements: content.length, empty: content.length === 0 }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const incident = { id: 'inc-1', displayId: 'INC000001' } as IncidentResponse
const alert = { id: 'alt-1', displayId: 'ALT000001' } as AlertResponse
const activeUser = { id: 'u1', name: 'Ada', active: true } as UserResponse
const inactiveUser = { id: 'u2', name: 'Grace', active: false } as UserResponse

describe('useActivityLookups', () => {
  beforeEach(() => {
    vi.mocked(incidentsApi.listIncidents).mockReset().mockResolvedValue(page([incident]))
    vi.mocked(alertsApi.listAlerts).mockReset().mockResolvedValue(page([alert]))
    vi.mocked(usersApi.listUsers).mockReset().mockResolvedValue([activeUser, inactiveUser])
  })

  it('builds lookup maps by id and by lowercased display id once all queries resolve', async () => {
    const { result } = renderHook(() => useActivityLookups(), { wrapper })

    await waitFor(() => expect(result.current.incidentById.size).toBe(1))

    expect(result.current.incidentById.get('inc-1')).toBe(incident)
    expect(result.current.alertById.get('alt-1')).toBe(alert)
    expect(result.current.incidentIdByDisplayId.get('inc000001')).toBe('inc-1')
    expect(result.current.alertIdByDisplayId.get('alt000001')).toBe('alt-1')
  })

  it('tags a deactivated user\'s name for historical attribution, leaves active names untouched', async () => {
    const { result } = renderHook(() => useActivityLookups(), { wrapper })

    await waitFor(() => expect(result.current.nameById.size).toBe(2))
    expect(result.current.nameById.get('u1')).toBe('Ada')
    expect(result.current.nameById.get('u2')).toBe('Grace (Deactivated)')
  })

  it('calls listUsers with includeInactive=true (historical resolution needs departed members)', async () => {
    renderHook(() => useActivityLookups(), { wrapper })
    await waitFor(() => expect(usersApi.listUsers).toHaveBeenCalledWith(true))
  })

  it('returns empty maps before data has loaded', () => {
    vi.mocked(incidentsApi.listIncidents).mockReturnValue(new Promise(() => {}))
    vi.mocked(alertsApi.listAlerts).mockReturnValue(new Promise(() => {}))
    vi.mocked(usersApi.listUsers).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useActivityLookups(), { wrapper })
    expect(result.current.incidentById.size).toBe(0)
    expect(result.current.alertById.size).toBe(0)
    expect(result.current.nameById.size).toBe(0)
  })
})
