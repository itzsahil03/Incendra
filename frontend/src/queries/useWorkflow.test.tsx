import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as workflowApi from '@/api/workflow'
import { incidentKeys } from './useIncidents'
import { useWorkflowStatesQuery, useIncidentStateQuery, useTransitionMutation } from './useWorkflow'

vi.mock('@/api/workflow')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(workflowApi.getWorkflowStates).mockReset()
  vi.mocked(workflowApi.getIncidentState).mockReset()
  vi.mocked(workflowApi.transitionIncident).mockReset()
  vi.useRealTimers()
})

describe('useWorkflowStatesQuery', () => {
  it('fetches the full state machine', async () => {
    vi.mocked(workflowApi.getWorkflowStates).mockResolvedValue({ states: ['Open', 'Closed'], transitions: {} })
    function Probe() {
      const { data } = useWorkflowStatesQuery()
      return <div data-testid="s">{data?.states.join(',') ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('Open,Closed'))
  })
})

describe('useIncidentStateQuery', () => {
  it('is disabled without an incidentId', () => {
    function Probe() {
      const { fetchStatus } = useIncidentStateQuery(undefined)
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
  })

  it('fetches by incidentId', async () => {
    vi.mocked(workflowApi.getIncidentState).mockResolvedValue({ state: 'Open' } as never)
    function Probe() {
      useIncidentStateQuery('inc-1')
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(workflowApi.getIncidentState).toHaveBeenCalledWith('inc-1'))
  })
})

describe('useTransitionMutation', () => {
  it('optimistically patches the incident detail cache with the new status and invalidates related queries', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(workflowApi.transitionIncident).mockResolvedValue({ to: 'Acknowledged' } as never)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(incidentKeys.detail('inc-1'), { id: 'inc-1', status: 'Open' })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    function Probe() {
      const { mutate } = useTransitionMutation('inc-1')
      return <button onClick={() => mutate({ toState: 'Acknowledged' })}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))

    await vi.waitFor(() => expect(workflowApi.transitionIncident).toHaveBeenCalledWith('inc-1', { toState: 'Acknowledged' }))
    expect(queryClient.getQueryData(incidentKeys.detail('inc-1'))).toEqual({ id: 'inc-1', status: 'Acknowledged' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workflow-state', 'inc-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: incidentKeys.all })

    // The reconciling refetch of the detail query is scheduled 3s later, not immediate.
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: incidentKeys.detail('inc-1') })
    await vi.advanceTimersByTimeAsync(3000)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: incidentKeys.detail('inc-1') })

    vi.useRealTimers()
  })

  it('leaves the cache alone when there was nothing cached for that incident yet', async () => {
    vi.mocked(workflowApi.transitionIncident).mockResolvedValue({ to: 'Acknowledged' } as never)
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Probe() {
      const { mutate } = useTransitionMutation('inc-1')
      return <button onClick={() => mutate({ toState: 'Acknowledged' })}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(workflowApi.transitionIncident).toHaveBeenCalled())
    expect(queryClient.getQueryData(incidentKeys.detail('inc-1'))).toBeUndefined()
  })
})
