import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as alertsApi from '@/api/alerts'
import {
  useAlertsQuery,
  useAlertSearchQuery,
  useAlertQuery,
  useAlertsSummaryQuery,
  useAcknowledgeAlertMutation,
  useUpdateAlertStatusMutation,
  useSetAlertDispositionMutation,
  useAssignAlertMutation,
  usePromoteAlertMutation,
  useLinkAlertMutation,
  useUnlinkAlertMutation,
  useAddAlertNoteMutation,
  useEditAlertNoteMutation,
  useDeleteAlertNoteMutation,
} from './useAlerts'

vi.mock('@/api/alerts')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function renderMutationProbe<T>(useHook: () => { mutate: (v: T) => void }, arg: T) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  function Probe() {
    const { mutate } = useHook()
    return <button onClick={() => mutate(arg)}>go</button>
  }
  render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  )
  return { invalidateSpy }
}

describe('useAlertsQuery', () => {
  beforeEach(() => vi.mocked(alertsApi.listAlerts).mockReset())

  it('passes page/size/acknowledged/incidentId through to listAlerts', async () => {
    vi.mocked(alertsApi.listAlerts).mockResolvedValue({ content: [] } as never)
    function Probe() {
      const { data } = useAlertsQuery(1, 20, true, 'inc-1')
      return <div data-testid="s">{data ? 'loaded' : 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('loaded'))
    expect(alertsApi.listAlerts).toHaveBeenCalledWith(1, 20, true, undefined, 'inc-1')
  })
})

describe('useAlertSearchQuery', () => {
  beforeEach(() => vi.mocked(alertsApi.listAlerts).mockReset())

  it('is disabled for a blank query', () => {
    function Probe() {
      const { fetchStatus } = useAlertSearchQuery('')
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
    expect(alertsApi.listAlerts).not.toHaveBeenCalled()
  })

  it('searches once a query is present', async () => {
    vi.mocked(alertsApi.listAlerts).mockResolvedValue({ content: [] } as never)
    function Probe() {
      useAlertSearchQuery('disk')
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(alertsApi.listAlerts).toHaveBeenCalledWith(0, 10, undefined, 'disk'))
  })
})

describe('useAlertQuery', () => {
  beforeEach(() => vi.mocked(alertsApi.getAlert).mockReset())

  it('is disabled without an id', () => {
    function Probe() {
      const { fetchStatus } = useAlertQuery(undefined)
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
  })

  it('fetches by id', async () => {
    vi.mocked(alertsApi.getAlert).mockResolvedValue({ id: 'a-1' } as never)
    function Probe() {
      const { data } = useAlertQuery('a-1')
      return <div data-testid="id">{data?.id ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('id')).toHaveTextContent('a-1'))
  })
})

describe('useAlertsSummaryQuery', () => {
  it('polls every 30s', async () => {
    vi.mocked(alertsApi.getAlertsSummary).mockResolvedValue({ total: 1 } as never)
    function Probe() {
      const query = useAlertsSummaryQuery()
      return <div data-testid="interval">{String(query.data !== undefined)}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('interval')).toHaveTextContent('true'))
    expect(alertsApi.getAlertsSummary).toHaveBeenCalled()
  })
})

describe('alert mutations', () => {
  beforeEach(() => {
    vi.mocked(alertsApi.acknowledgeAlert).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(alertsApi.updateAlertStatus).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(alertsApi.setAlertDisposition).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(alertsApi.assignAlert).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(alertsApi.promoteAlert).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(alertsApi.linkAlertToIncident).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(alertsApi.unlinkAlertFromIncident).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(alertsApi.addAlertNote).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(alertsApi.editAlertNote).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(alertsApi.deleteAlertNote).mockReset().mockResolvedValue(undefined as never)
  })

  it('useAcknowledgeAlertMutation calls the api and invalidates alerts', async () => {
    const user = userEvent.setup()
    const { invalidateSpy } = renderMutationProbe(useAcknowledgeAlertMutation, 'a-1')
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['alerts'] }))
    expect(vi.mocked(alertsApi.acknowledgeAlert).mock.calls[0][0]).toBe('a-1')
  })

  it('useUpdateAlertStatusMutation calls the api with id/status', async () => {
    const user = userEvent.setup()
    const { invalidateSpy } = renderMutationProbe(useUpdateAlertStatusMutation, { id: 'a-1', status: 'Open' })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(alertsApi.updateAlertStatus).toHaveBeenCalledWith('a-1', 'Open'))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['alerts'] })
  })

  it('useSetAlertDispositionMutation calls the api with disposition/reason', async () => {
    const user = userEvent.setup()
    renderMutationProbe(useSetAlertDispositionMutation, { id: 'a-1', disposition: 'FALSE_POSITIVE' as never, reason: 'flaky' })
    await user.click(screen.getByText('go'))
    await waitFor(() =>
      expect(alertsApi.setAlertDisposition).toHaveBeenCalledWith('a-1', { disposition: 'FALSE_POSITIVE', reason: 'flaky' }),
    )
  })

  it('useAssignAlertMutation calls the api with assignee fields', async () => {
    const user = userEvent.setup()
    renderMutationProbe(useAssignAlertMutation, { id: 'a-1', assigneeId: 'u1', assigneeName: 'Alice' })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(alertsApi.assignAlert).toHaveBeenCalledWith('a-1', { assigneeId: 'u1', assigneeName: 'Alice' }))
  })

  it('usePromoteAlertMutation calls the api', async () => {
    const user = userEvent.setup()
    renderMutationProbe(usePromoteAlertMutation, 'a-1')
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(vi.mocked(alertsApi.promoteAlert).mock.calls[0][0]).toBe('a-1'))
  })

  it('useLinkAlertMutation calls the api with id/incidentId', async () => {
    const user = userEvent.setup()
    renderMutationProbe(useLinkAlertMutation, { id: 'a-1', incidentId: 'inc-1' })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(alertsApi.linkAlertToIncident).toHaveBeenCalledWith('a-1', 'inc-1'))
  })

  it('useUnlinkAlertMutation calls the api', async () => {
    const user = userEvent.setup()
    renderMutationProbe(useUnlinkAlertMutation, 'a-1')
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(vi.mocked(alertsApi.unlinkAlertFromIncident).mock.calls[0][0]).toBe('a-1'))
  })

  it('useAddAlertNoteMutation calls the api with author/text', async () => {
    const user = userEvent.setup()
    renderMutationProbe(useAddAlertNoteMutation, { id: 'a-1', authorName: 'Alice', text: 'note' })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(alertsApi.addAlertNote).toHaveBeenCalledWith('a-1', 'Alice', 'note'))
  })

  it('useEditAlertNoteMutation calls the api with noteId/text', async () => {
    const user = userEvent.setup()
    renderMutationProbe(useEditAlertNoteMutation, { id: 'a-1', noteId: 'n-1', text: 'edited' })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(alertsApi.editAlertNote).toHaveBeenCalledWith('a-1', 'n-1', 'edited'))
  })

  it('useDeleteAlertNoteMutation calls the api with noteId', async () => {
    const user = userEvent.setup()
    renderMutationProbe(useDeleteAlertNoteMutation, { id: 'a-1', noteId: 'n-1' })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(alertsApi.deleteAlertNote).toHaveBeenCalledWith('a-1', 'n-1'))
  })
})
