import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDeliveryPayloadQuery } from '@/queries/useWebhookDeliveries'
import { DeliveryTable } from './DeliveryTable'
import type { WebhookDeliveryResponse } from '@/api/webhookDeliveries'
import type { Page } from '@/api/types'

vi.mock('@/queries/useWebhookDeliveries')

const mockUsePayload = vi.mocked(useDeliveryPayloadQuery)

function delivery(overrides: Partial<WebhookDeliveryResponse> = {}): WebhookDeliveryResponse {
  return {
    id: 'd1',
    webhookId: 'wh-1',
    topic: 'incident.created',
    attemptedAt: '2026-01-01T00:00:00Z',
    statusCode: 200,
    outcome: 'DELIVERED',
    latencyMs: 120,
    errorMessage: null,
    attemptNumber: 1,
    nextRetryAt: null,
    ...overrides,
  }
}

function page(content: WebhookDeliveryResponse[], overrides: Partial<Page<WebhookDeliveryResponse>> = {}): Page<WebhookDeliveryResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 20,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
    ...overrides,
  }
}

function renderTable(props: Partial<React.ComponentProps<typeof DeliveryTable>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DeliveryTable deliveries={page([delivery()])} loading={false} page={0} onPageChange={vi.fn()} {...props} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockUsePayload.mockReturnValue({ data: undefined, isLoading: false } as never)
})

describe('DeliveryTable — loading/empty', () => {
  it('shows a loading state', () => {
    renderTable({ loading: true, deliveries: undefined })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no deliveries', () => {
    renderTable({ deliveries: page([]) })
    expect(screen.getByText('No deliveries yet')).toBeInTheDocument()
  })
})

describe('DeliveryTable — rows', () => {
  it('renders a row with topic, outcome, status code, and latency', () => {
    renderTable()
    expect(screen.getByText('incident.created')).toBeInTheDocument()
    expect(screen.getByText('Delivered')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('120ms')).toBeInTheDocument()
  })

  it('shows a dash for a missing status code', () => {
    renderTable({ deliveries: page([delivery({ statusCode: null })]) })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows a retrying label with the attempt number', () => {
    renderTable({ deliveries: page([delivery({ outcome: 'RETRYING', attemptNumber: 3 })]) })
    expect(screen.getByText('Retrying (attempt 3)')).toBeInTheDocument()
  })

  it('shows a Webhook column with the resolved label when webhookLabels is passed', () => {
    renderTable({ webhookLabels: { 'wh-1': 'My Webhook' } })
    expect(screen.getByText('Webhook')).toBeInTheDocument()
    expect(screen.getByText('My Webhook')).toBeInTheDocument()
  })

  it('falls back to the raw webhookId when webhookLabels has no entry for it', () => {
    renderTable({ webhookLabels: { 'other-wh': 'Other' } })
    expect(screen.getByText('wh-1')).toBeInTheDocument()
  })

  it('omits the Webhook column entirely when webhookLabels is not passed', () => {
    renderTable()
    expect(screen.queryByText('Webhook')).not.toBeInTheDocument()
  })
})

describe('DeliveryTable — row expansion', () => {
  it('expands a row on click and shows a loading state while payload loads', async () => {
    mockUsePayload.mockReturnValue({ data: undefined, isLoading: true } as never)
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('incident.created'))
    expect(screen.queryByText('Request Body')).not.toBeInTheDocument()
  })

  it('shows the request/response body once the payload loads', async () => {
    mockUsePayload.mockReturnValue({
      data: { deliveryId: 'd1', requestBody: '{"a":1}', responseBody: '{"ok":true}', responseHeaders: { 'x-test': '1' } },
      isLoading: false,
    } as never)
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('incident.created'))
    expect(await screen.findByText('Request Body')).toBeInTheDocument()
    expect(screen.getByText('{"a":1}')).toBeInTheDocument()
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument()
    expect(screen.getByText('x-test: 1')).toBeInTheDocument()
  })

  it('shows dashes when request/response bodies are null', async () => {
    mockUsePayload.mockReturnValue({
      data: { deliveryId: 'd1', requestBody: null, responseBody: null, responseHeaders: {} },
      isLoading: false,
    } as never)
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('incident.created'))
    expect(await screen.findAllByText('—')).not.toHaveLength(0)
  })

  it('collapses again on a second click', async () => {
    mockUsePayload.mockReturnValue({
      data: { deliveryId: 'd1', requestBody: 'x', responseBody: 'y', responseHeaders: {} },
      isLoading: false,
    } as never)
    const user = userEvent.setup()
    renderTable()
    await user.click(screen.getByText('incident.created'))
    expect(await screen.findByText('Request Body')).toBeInTheDocument()
    await user.click(screen.getByText('incident.created'))
    expect(screen.queryByText('Request Body')).not.toBeInTheDocument()
  })
})

describe('DeliveryTable — pagination', () => {
  it('shows the page summary and disables prev/next at the boundaries', () => {
    renderTable({ deliveries: page([delivery()], { number: 0, totalPages: 1, totalElements: 1, first: true, last: true }) })
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument()
    const [prev, next] = screen.getAllByRole('button')
    expect(prev).toBeDisabled()
    expect(next).toBeDisabled()
  })

  it('calls onPageChange with the next/prev page', async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    renderTable({
      deliveries: page([delivery()], { number: 1, totalPages: 3, totalElements: 30, first: false, last: false }),
      page: 1,
      onPageChange,
    })
    const [prev, next] = screen.getAllByRole('button')
    await user.click(next)
    expect(onPageChange).toHaveBeenCalledWith(2)
    await user.click(prev)
    expect(onPageChange).toHaveBeenCalledWith(0)
  })
})
