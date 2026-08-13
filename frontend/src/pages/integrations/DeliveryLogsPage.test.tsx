import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useWebhooksQuery } from '@/queries/useWebhooks'
import { useOrgDeliveriesQuery, useDeliveryPayloadQuery } from '@/queries/useWebhookDeliveries'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { DeliveryLogsPage } from './DeliveryLogsPage'

vi.mock('@/queries/useWebhooks')
vi.mock('@/queries/useWebhookDeliveries')

beforeAll(stubRadixEnvironment)

const mockWebhooks = vi.mocked(useWebhooksQuery)
const mockOrgDeliveries = vi.mocked(useOrgDeliveriesQuery)
const mockDeliveryPayload = vi.mocked(useDeliveryPayloadQuery)

function emptyPage() {
  return { content: [], totalElements: 0, totalPages: 1, number: 0, size: 20, first: true, last: true, numberOfElements: 0, empty: true }
}

function renderPage() {
  return render(<DeliveryLogsPage />, { wrapper: MemoryRouter })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWebhooks.mockReturnValue({ data: [{ id: 'w1', url: 'https://example.com/hook', provider: 'GENERIC', active: true, subscribedTopics: [], createdAt: '', orgId: 'org-1', previousSecretExpiresAt: null }] } as never)
  mockOrgDeliveries.mockReturnValue({ data: emptyPage(), isLoading: false } as never)
  mockDeliveryPayload.mockReturnValue({ data: undefined, isLoading: false } as never)
})

describe('DeliveryLogsPage', () => {
  it('shows an empty state with no deliveries', () => {
    renderPage()
    expect(screen.getByText('No deliveries yet')).toBeInTheDocument()
  })

  it('renders a delivery row when data is present', () => {
    mockOrgDeliveries.mockReturnValue({
      data: { ...emptyPage(), content: [{ id: 'd1', webhookId: 'w1', topic: 'incident.created', attemptedAt: '2026-01-01T00:00:00Z', statusCode: 200, outcome: 'DELIVERED', latencyMs: 90, errorMessage: null, attemptNumber: 1, nextRetryAt: null }], totalElements: 1, empty: false },
      isLoading: false,
    } as never)
    renderPage()
    expect(screen.getByText('incident.created')).toBeInTheDocument()
    expect(screen.getByText('https://example.com/hook')).toBeInTheDocument()
  })

  it('filters by outcome via the toggle group', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('radio', { name: 'Failed' }))
    expect(mockOrgDeliveries).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'Failed' }))
  })

  it('filters by topic', async () => {
    const user = userEvent.setup()
    renderPage()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[0])
    const listbox = await screen.findByRole('listbox')
    const option = within(listbox).getAllByRole('option')[1]
    await user.click(option)
    expect(mockOrgDeliveries).toHaveBeenLastCalledWith(expect.objectContaining({ topic: expect.any(String) }))
  })

  it('filters by time range', async () => {
    const user = userEvent.setup()
    renderPage()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[1])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Last 24h'))
    expect(mockOrgDeliveries).toHaveBeenLastCalledWith(expect.objectContaining({ since: expect.any(String) }))
  })

  it('filters by webhook', async () => {
    const user = userEvent.setup()
    renderPage()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[2])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('https://example.com/hook'))
    expect(mockOrgDeliveries).toHaveBeenLastCalledWith(expect.objectContaining({ webhookId: 'w1' }))
  })

  it('searches via the debounced input', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText('Search event, request ID…'), 'abc123')
    await vi.waitFor(() => expect(mockOrgDeliveries).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'abc123' })), { timeout: 1000 })
  })
})
