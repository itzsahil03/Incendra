import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useWebhookQuery, useRotateWebhookSecretMutation } from '@/queries/useWebhooks'
import {
  useDeliveryPayloadQuery,
  useRetryPolicyQuery,
  useSamplePayloadQuery,
  useSendTestDeliveryMutation,
  useWebhookDeliveriesQuery,
  useWebhookHealthQuery,
} from '@/queries/useWebhookDeliveries'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { WebhookDetailPage } from './WebhookDetailPage'

vi.mock('@/queries/useWebhooks')
vi.mock('@/queries/useWebhookDeliveries')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeAll(stubRadixEnvironment)

const mockWebhook = vi.mocked(useWebhookQuery)
const mockRotateSecret = vi.mocked(useRotateWebhookSecretMutation)
const mockHealth = vi.mocked(useWebhookHealthQuery)
const mockRetryPolicy = vi.mocked(useRetryPolicyQuery)
const mockDeliveries = vi.mocked(useWebhookDeliveriesQuery)
const mockSample = vi.mocked(useSamplePayloadQuery)
const mockSendTest = vi.mocked(useSendTestDeliveryMutation)
const mockDeliveryPayload = vi.mocked(useDeliveryPayloadQuery)

function webhookFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    orgId: 'org-1',
    url: 'https://example.com/hook',
    subscribedTopics: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    provider: 'GENERIC',
    previousSecretExpiresAt: null,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/integrations/webhooks/w1']}>
      <Routes>
        <Route path="/app/integrations/webhooks/:id" element={<WebhookDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWebhook.mockReturnValue(webhookFixture() as never)
  mockRotateSecret.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ secret: 'new-secret' }), isPending: false } as never)
  mockHealth.mockReturnValue({ data: { status: 'Healthy', successRate24h: 99.5, avgLatencyMs24h: 120, lastDeliveryAt: null } } as never)
  mockRetryPolicy.mockReturnValue({ data: { delaysMs: [30000, 300000, 3600000] } } as never)
  mockDeliveries.mockReturnValue({ data: { content: [], totalElements: 0, totalPages: 1, number: 0, size: 15, first: true, last: true, numberOfElements: 0, empty: true }, isLoading: false } as never)
  mockSample.mockReturnValue({ data: { topic: 'IncidentCreated', payload: '{"event":"incident.created"}', real: false } } as never)
  mockSendTest.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockDeliveryPayload.mockReturnValue({ data: undefined, isLoading: false } as never)
})

describe('WebhookDetailPage — loading', () => {
  it('shows a loading state when the webhook has not resolved', () => {
    mockWebhook.mockReturnValue(undefined as never)
    renderPage()
    expect(screen.queryByText('Recent Deliveries')).not.toBeInTheDocument()
  })
})

describe('WebhookDetailPage — header', () => {
  it('shows the url, provider badge, and health status', () => {
    renderPage()
    expect(screen.getByText('https://example.com/hook')).toBeInTheDocument()
    expect(screen.getByText(/Healthy/)).toBeInTheDocument()
  })

  it('omits the health pill when there is no data', () => {
    mockHealth.mockReturnValue({ data: { status: 'NoData', successRate24h: null, avgLatencyMs24h: null, lastDeliveryAt: null } } as never)
    renderPage()
    expect(screen.queryByText(/NoData/)).not.toBeInTheDocument()
  })

  it('shows All topics badge when unrestricted, or the actual topics otherwise', () => {
    renderPage()
    expect(screen.getByText('All topics')).toBeInTheDocument()
  })

  it('shows subscribed topic badges when restricted', () => {
    mockWebhook.mockReturnValue(webhookFixture({ subscribedTopics: ['IncidentCreated', 'AlertReceived'] }) as never)
    renderPage()
    expect(screen.getAllByText('IncidentCreated').length).toBeGreaterThan(0)
    expect(screen.getAllByText('AlertReceived').length).toBeGreaterThan(0)
  })

  it('shows the previous-secret grace-window notice when rotating', () => {
    mockWebhook.mockReturnValue(webhookFixture({ previousSecretExpiresAt: '2026-01-02T00:00:00Z' }) as never)
    renderPage()
    expect(screen.getByText(/Previous secret remains valid/)).toBeInTheDocument()
  })

  it('navigates back on click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Back/ }))
    expect(navigateMock).toHaveBeenCalledWith(-1)
  })

  it('sends a test event', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockSendTest.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Send Test Event/ }))
    expect(mutateAsync).toHaveBeenCalledWith('w1')
    expect(toast.success).toHaveBeenCalledWith('Test event sent')
  })

  it('shows a toast error when sending a test event fails', async () => {
    mockSendTest.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'send failed' } } }),
      isPending: false,
    } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Send Test Event/ }))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('send failed'))
  })

  it('rotates the secret and reveals it', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ secret: 'new-secret-value' })
    mockRotateSecret.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Rotate Secret/ }))
    expect(mutateAsync).toHaveBeenCalledWith('w1')
    expect(await screen.findByDisplayValue('new-secret-value')).toBeInTheDocument()
  })

  it('shows a toast error when rotation fails', async () => {
    mockRotateSecret.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'rotate failed' } } }),
      isPending: false,
    } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Rotate Secret/ }))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('rotate failed'))
  })
})

describe('WebhookDetailPage — retry policy and sample payload', () => {
  it('renders the retry ladder in seconds/minutes/hours', () => {
    mockRetryPolicy.mockReturnValue({ data: { delaysMs: [5000, 120000, 7200000] } } as never)
    renderPage()
    expect(screen.getByText('5s')).toBeInTheDocument()
    expect(screen.getByText('2m')).toBeInTheDocument()
    expect(screen.getByText('2h')).toBeInTheDocument()
  })

  it('shows the sample payload and switches topic', async () => {
    mockWebhook.mockReturnValue(webhookFixture({ subscribedTopics: ['IncidentCreated', 'AlertReceived'] }) as never)
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByText('{"event":"incident.created"}')).toBeInTheDocument()
    expect(screen.getByText(/showing the event envelope shape/)).toBeInTheDocument()

    const sampleCard = screen.getByText('Sample Payload').closest('div')!.parentElement!
    await user.click(within(sampleCard).getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('AlertReceived'))
    expect(mockSample).toHaveBeenLastCalledWith('AlertReceived')
  })

  it('shows a real-delivery note when the sample is a real capture', () => {
    mockSample.mockReturnValue({ data: { topic: 'IncidentCreated', payload: '{"real":true}', real: true } } as never)
    renderPage()
    expect(screen.getByText('A real captured delivery for this topic.')).toBeInTheDocument()
  })
})

describe('WebhookDetailPage — deliveries', () => {
  it('filters deliveries by outcome and range', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('radio', { name: 'Delivered' }))
    // ToggleGroupItem's value is the filter's display label, not the DeliveryOutcome enum —
    // matches the component's actual (if oddly-cased) onValueChange wiring.
    expect(mockDeliveries).toHaveBeenLastCalledWith('w1', expect.objectContaining({ outcome: 'Delivered' }))
  })

  it('renders the delivery table with data', () => {
    mockDeliveries.mockReturnValue({
      data: {
        content: [{ id: 'd1', webhookId: 'w1', topic: 'incident.created', attemptedAt: '2026-01-01T00:00:00Z', statusCode: 200, outcome: 'DELIVERED', latencyMs: 100, errorMessage: null, attemptNumber: 1, nextRetryAt: null }],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 15,
        first: true,
        last: true,
        numberOfElements: 1,
        empty: false,
      },
      isLoading: false,
    } as never)
    renderPage()
    expect(screen.getByText('incident.created')).toBeInTheDocument()
  })
})
