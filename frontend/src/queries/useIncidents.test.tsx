import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as incidentsApi from '@/api/incidents'
import {
  incidentKeys,
  useIncidentsQuery,
  useIncidentSearchQuery,
  useIncidentQuery,
  useCreateIncidentMutation,
  useUpdateIncidentMutation,
  useDeleteIncidentMutation,
  useUpdatePriorityMutation,
  useAssignIncidentMutation,
  useAssignReporterMutation,
  useAddParticipantMutation,
  useRemoveParticipantMutation,
  useUpdateContextMutation,
} from './useIncidents'

vi.mock('@/api/incidents')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('incidentKeys', () => {
  it('list() includes page/size/q, defaulting q to empty string', () => {
    expect(incidentKeys.list(0, 50)).toEqual(['incidents', 'list', 0, 50, ''])
    expect(incidentKeys.list(1, 20, 'db')).toEqual(['incidents', 'list', 1, 20, 'db'])
  })

  it('detail() is keyed by id', () => {
    expect(incidentKeys.detail('inc-1')).toEqual(['incidents', 'detail', 'inc-1'])
  })
})

describe('useIncidentsQuery', () => {
  beforeEach(() => vi.mocked(incidentsApi.listIncidents).mockReset())

  it('calls listIncidents with page/size/q', async () => {
    vi.mocked(incidentsApi.listIncidents).mockResolvedValue({ content: [], totalElements: 0 } as never)
    function Probe() {
      const { data } = useIncidentsQuery(2, 25, 'disk')
      return <div data-testid="count">{data ? 'loaded' : 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('loaded'))
    expect(incidentsApi.listIncidents).toHaveBeenCalledWith(2, 25, 'disk')
  })
})

describe('useIncidentSearchQuery', () => {
  beforeEach(() => vi.mocked(incidentsApi.listIncidents).mockReset())

  it('is disabled when q is blank', () => {
    function Probe() {
      const { fetchStatus } = useIncidentSearchQuery('   ')
      return <div data-testid="status">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('status')).toHaveTextContent('idle')
    expect(incidentsApi.listIncidents).not.toHaveBeenCalled()
  })

  it('fires once q is non-empty, requesting a small page', async () => {
    vi.mocked(incidentsApi.listIncidents).mockResolvedValue({ content: [], totalElements: 0 } as never)
    function Probe() {
      useIncidentSearchQuery('db down')
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(incidentsApi.listIncidents).toHaveBeenCalledWith(0, 10, 'db down'))
  })
})

describe('useIncidentQuery', () => {
  beforeEach(() => vi.mocked(incidentsApi.getIncident).mockReset())

  it('is disabled when id is undefined', () => {
    function Probe() {
      const { fetchStatus } = useIncidentQuery(undefined)
      return <div data-testid="status">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('status')).toHaveTextContent('idle')
    expect(incidentsApi.getIncident).not.toHaveBeenCalled()
  })

  it('fetches by id when provided', async () => {
    vi.mocked(incidentsApi.getIncident).mockResolvedValue({ id: 'inc-1' } as never)
    function Probe() {
      const { data } = useIncidentQuery('inc-1')
      return <div data-testid="id">{data?.id ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('id')).toHaveTextContent('inc-1'))
    expect(incidentsApi.getIncident).toHaveBeenCalledWith('inc-1')
  })
})

describe('incident mutations invalidate/update the right cache entries', () => {
  beforeEach(() => {
    vi.mocked(incidentsApi.createIncident).mockReset().mockResolvedValue({ id: 'inc-new' } as never)
    vi.mocked(incidentsApi.updateIncident).mockReset().mockResolvedValue({ id: 'inc-1', title: 'Updated' } as never)
    vi.mocked(incidentsApi.deleteIncident).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(incidentsApi.updatePriority).mockReset().mockResolvedValue({ id: 'inc-1', priority: 'P1' } as never)
    vi.mocked(incidentsApi.assignIncident).mockReset().mockResolvedValue({ id: 'inc-1' } as never)
    vi.mocked(incidentsApi.assignReporter).mockReset().mockResolvedValue({ id: 'inc-1' } as never)
    vi.mocked(incidentsApi.addParticipant).mockReset().mockResolvedValue({ id: 'inc-1' } as never)
    vi.mocked(incidentsApi.removeParticipant).mockReset().mockResolvedValue({ id: 'inc-1' } as never)
    vi.mocked(incidentsApi.updateContext).mockReset().mockResolvedValue({ id: 'inc-1' } as never)
  })

  function makeClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } })
  }

  it('useCreateIncidentMutation invalidates the incidents list on success', async () => {
    const user = userEvent.setup()
    const queryClient = makeClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useCreateIncidentMutation()
      return <button onClick={() => mutate({ title: 'New', description: '' } as never)}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: incidentKeys.all }))
  })

  it('useUpdateIncidentMutation patches the detail cache and invalidates the list', async () => {
    const user = userEvent.setup()
    const queryClient = makeClient()
    const setSpy = vi.spyOn(queryClient, 'setQueryData')
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useUpdateIncidentMutation('inc-1')
      return <button onClick={() => mutate({ title: 'Updated' })}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(setSpy).toHaveBeenCalledWith(incidentKeys.detail('inc-1'), { id: 'inc-1', title: 'Updated' }))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: incidentKeys.all })
  })

  it('useDeleteIncidentMutation invalidates the list on success', async () => {
    const user = userEvent.setup()
    const queryClient = makeClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useDeleteIncidentMutation()
      return <button onClick={() => mutate('inc-1')}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: incidentKeys.all }))
    // mutationFn is passed directly (not wrapped), so react-query calls it with its own
    // second "context" argument (client/meta/mutationKey) too — only the first arg matters here.
    expect(vi.mocked(incidentsApi.deleteIncident).mock.calls[0][0]).toBe('inc-1')
  })

  it('useUpdatePriorityMutation patches the detail cache', async () => {
    const user = userEvent.setup()
    const queryClient = makeClient()
    const setSpy = vi.spyOn(queryClient, 'setQueryData')
    function Probe() {
      const { mutate } = useUpdatePriorityMutation('inc-1')
      return <button onClick={() => mutate('P1')}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(incidentsApi.updatePriority).toHaveBeenCalledWith('inc-1', 'P1'))
    expect(setSpy).toHaveBeenCalledWith(incidentKeys.detail('inc-1'), { id: 'inc-1', priority: 'P1' })
  })

  it('useAssignIncidentMutation calls the api with assignee fields', async () => {
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useAssignIncidentMutation('inc-1')
      return <button onClick={() => mutate({ assigneeId: 'u1', assigneeName: 'Alice' })}>go</button>
    }
    render(<Probe />, { wrapper })
    await user.click(screen.getByText('go'))
    await waitFor(() =>
      expect(incidentsApi.assignIncident).toHaveBeenCalledWith('inc-1', { assigneeId: 'u1', assigneeName: 'Alice' }),
    )
  })

  it('useAssignReporterMutation calls the api with reporter fields', async () => {
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useAssignReporterMutation('inc-1')
      return <button onClick={() => mutate({ reporterId: 'u1', reporterName: 'Alice' })}>go</button>
    }
    render(<Probe />, { wrapper })
    await user.click(screen.getByText('go'))
    await waitFor(() =>
      expect(incidentsApi.assignReporter).toHaveBeenCalledWith('inc-1', { reporterId: 'u1', reporterName: 'Alice' }),
    )
  })

  it('useAddParticipantMutation calls the api with participant fields', async () => {
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useAddParticipantMutation('inc-1')
      return <button onClick={() => mutate({ userId: 'u1', userName: 'Alice' })}>go</button>
    }
    render(<Probe />, { wrapper })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(incidentsApi.addParticipant).toHaveBeenCalledWith('inc-1', { userId: 'u1', userName: 'Alice' }))
  })

  it('useRemoveParticipantMutation calls the api with the participant user id', async () => {
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useRemoveParticipantMutation('inc-1')
      return <button onClick={() => mutate('u1')}>go</button>
    }
    render(<Probe />, { wrapper })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(incidentsApi.removeParticipant).toHaveBeenCalledWith('inc-1', 'u1'))
  })

  it('useUpdateContextMutation calls the api with the full context payload', async () => {
    const user = userEvent.setup()
    const body = {
      environment: 'prod',
      region: 'us-east-1',
      businessImpact: 'high',
      affectedComponents: ['api'],
      contextNotes: 'note',
    }
    function Probe() {
      const { mutate } = useUpdateContextMutation('inc-1')
      return <button onClick={() => mutate(body)}>go</button>
    }
    render(<Probe />, { wrapper })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(incidentsApi.updateContext).toHaveBeenCalledWith('inc-1', body))
  })
})
