import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as deliveriesApi from '@/api/webhookDeliveries'
import {
  useWebhookDeliveriesQuery,
  useOrgDeliveriesQuery,
  useDeliveryPayloadQuery,
  useRecentFailedDeliveriesQuery,
  useWebhookHealthQuery,
  useWebhookStatsQuery,
  useLastActivityQuery,
  useHealthSummaryQuery,
  useSamplePayloadQuery,
  useRetryPolicyQuery,
  useSendTestDeliveryMutation,
} from './useWebhookDeliveries'

vi.mock('@/api/webhookDeliveries')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(deliveriesApi.listWebhookDeliveries).mockReset().mockResolvedValue({ content: [] } as never)
  vi.mocked(deliveriesApi.listOrgDeliveries).mockReset().mockResolvedValue({ content: [] } as never)
  vi.mocked(deliveriesApi.getDeliveryPayload).mockReset().mockResolvedValue({} as never)
  vi.mocked(deliveriesApi.getRecentFailedDeliveries).mockReset().mockResolvedValue([] as never)
  vi.mocked(deliveriesApi.getWebhookHealth).mockReset().mockResolvedValue({} as never)
  vi.mocked(deliveriesApi.getWebhookStats).mockReset().mockResolvedValue({} as never)
  vi.mocked(deliveriesApi.getLastActivity).mockReset().mockResolvedValue({} as never)
  vi.mocked(deliveriesApi.getHealthSummary).mockReset().mockResolvedValue({} as never)
  vi.mocked(deliveriesApi.getSamplePayload).mockReset().mockResolvedValue({} as never)
  vi.mocked(deliveriesApi.getRetryPolicy).mockReset().mockResolvedValue({ delaysMs: [] } as never)
  vi.mocked(deliveriesApi.sendTestDelivery).mockReset().mockResolvedValue(undefined as never)
})

describe('useWebhookDeliveriesQuery', () => {
  it('is disabled without a webhookId', () => {
    function Probe() {
      const { fetchStatus } = useWebhookDeliveriesQuery(undefined, {})
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
  })

  it('fetches once a webhookId is provided', async () => {
    function Probe() {
      useWebhookDeliveriesQuery('wh-1', { outcome: 'FAILED' })
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.listWebhookDeliveries).toHaveBeenCalledWith('wh-1', { outcome: 'FAILED' }))
  })
})

describe('useOrgDeliveriesQuery', () => {
  it('passes params through', async () => {
    function Probe() {
      useOrgDeliveriesQuery({ webhookId: 'wh-1' })
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.listOrgDeliveries).toHaveBeenCalledWith({ webhookId: 'wh-1' }))
  })
})

describe('useDeliveryPayloadQuery', () => {
  it('is disabled without a deliveryId', () => {
    function Probe() {
      const { fetchStatus } = useDeliveryPayloadQuery(undefined)
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
  })

  it('fetches by deliveryId', async () => {
    function Probe() {
      useDeliveryPayloadQuery('d-1')
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.getDeliveryPayload).toHaveBeenCalledWith('d-1'))
  })
})

describe('remaining read queries pass their params through', () => {
  it('useRecentFailedDeliveriesQuery', async () => {
    function Probe() {
      useRecentFailedDeliveriesQuery(3)
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.getRecentFailedDeliveries).toHaveBeenCalledWith(3))
  })

  it('useWebhookHealthQuery is disabled without a webhookId', () => {
    function Probe() {
      const { fetchStatus } = useWebhookHealthQuery(undefined)
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
  })

  it('useWebhookHealthQuery fetches by webhookId', async () => {
    function Probe() {
      useWebhookHealthQuery('wh-1')
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.getWebhookHealth).toHaveBeenCalledWith('wh-1'))
  })

  it('useWebhookStatsQuery', async () => {
    function Probe() {
      useWebhookStatsQuery()
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.getWebhookStats).toHaveBeenCalled())
  })

  it('useLastActivityQuery', async () => {
    function Probe() {
      useLastActivityQuery()
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.getLastActivity).toHaveBeenCalled())
  })

  it('useHealthSummaryQuery', async () => {
    function Probe() {
      useHealthSummaryQuery()
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.getHealthSummary).toHaveBeenCalled())
  })

  it('useSamplePayloadQuery is disabled without a topic', () => {
    function Probe() {
      const { fetchStatus } = useSamplePayloadQuery(undefined)
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
  })

  it('useSamplePayloadQuery fetches by topic', async () => {
    function Probe() {
      useSamplePayloadQuery('INCIDENT_CREATED')
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.getSamplePayload).toHaveBeenCalledWith('INCIDENT_CREATED'))
  })

  it('useRetryPolicyQuery', async () => {
    function Probe() {
      useRetryPolicyQuery()
      return null
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(deliveriesApi.getRetryPolicy).toHaveBeenCalled())
  })
})

describe('useSendTestDeliveryMutation', () => {
  it('invalidates every dependent query on success', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useSendTestDeliveryMutation()
      return <button onClick={() => mutate('wh-1')}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['webhook-deliveries'] }))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['org-deliveries'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['webhook-health'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['webhook-health-summary'] })
    expect(vi.mocked(deliveriesApi.sendTestDelivery).mock.calls[0][0]).toBe('wh-1')
  })
})
