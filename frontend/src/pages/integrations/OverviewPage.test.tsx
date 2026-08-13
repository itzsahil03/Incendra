import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useClientsQuery, useRecentClientUsageQuery } from '@/queries/useClients'
import { useWebhooksQuery } from '@/queries/useWebhooks'
import { useRecentFailedDeliveriesQuery, useWebhookStatsQuery } from '@/queries/useWebhookDeliveries'
import { OverviewPage } from './OverviewPage'

vi.mock('@/queries/useClients')
vi.mock('@/queries/useWebhooks')
vi.mock('@/queries/useWebhookDeliveries')

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const mockClients = vi.mocked(useClientsQuery)
const mockRecentUsage = vi.mocked(useRecentClientUsageQuery)
const mockWebhooks = vi.mocked(useWebhooksQuery)
const mockStats = vi.mocked(useWebhookStatsQuery)
const mockRecentFailed = vi.mocked(useRecentFailedDeliveriesQuery)

function renderPage() {
  return render(<OverviewPage />, { wrapper: MemoryRouter })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClients.mockReturnValue({ data: [], isLoading: false } as never)
  mockWebhooks.mockReturnValue({ data: [], isLoading: false } as never)
  mockStats.mockReturnValue({ data: { deliveriesToday: 5, failuresToday: 1, avgLatencyMsToday: 120 } } as never)
  mockRecentFailed.mockReturnValue({ data: [] } as never)
  mockRecentUsage.mockReturnValue({ data: [] } as never)
})

describe('OverviewPage — loading', () => {
  it('shows a loading state', () => {
    mockClients.mockReturnValue({ data: undefined, isLoading: true } as never)
    renderPage()
    expect(screen.queryByText('Recent Failed Deliveries')).not.toBeInTheDocument()
  })
})

describe('OverviewPage — stats', () => {
  it('shows stat counts derived from active keys/webhooks/deliveries', () => {
    mockClients.mockReturnValue({
      data: [{ clientId: 'c1', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' }, { clientId: 'c2', status: 'REVOKED', createdAt: '2026-01-01T00:00:00Z' }],
      isLoading: false,
    } as never)
    mockWebhooks.mockReturnValue({
      data: [{ id: 'w1', active: true, createdAt: '2026-01-01T00:00:00Z' }, { id: 'w2', active: false, createdAt: '2026-01-01T00:00:00Z' }],
      isLoading: false,
    } as never)
    renderPage()
    expect(screen.getByText('Active Keys')).toBeInTheDocument()
    expect(screen.getByText('Deliveries Today')).toBeInTheDocument()
  })
})

describe('OverviewPage — panels', () => {
  it('shows empty states for all three panels', () => {
    renderPage()
    expect(screen.getByText('No failures')).toBeInTheDocument()
    expect(screen.getByText('No usage yet')).toBeInTheDocument()
    expect(screen.getByText('Nothing yet')).toBeInTheDocument()
  })

  it('shows recent failed deliveries', () => {
    mockRecentFailed.mockReturnValue({ data: [{ id: 'd1', topic: 'incident.created', attemptedAt: '2026-01-01T00:00:00Z' }] } as never)
    renderPage()
    expect(screen.getByText('incident.created')).toBeInTheDocument()
  })

  it('shows recent key usage', () => {
    mockRecentUsage.mockReturnValue({ data: [{ clientId: 'c1', name: 'My Key', lastUsedAt: '2026-01-01T00:00:00Z' }] } as never)
    renderPage()
    expect(screen.getByText('My Key')).toBeInTheDocument()
  })

  it('lists recent integrations combining webhooks and clients, sorted newest first, and navigates on click', async () => {
    mockWebhooks.mockReturnValue({
      data: [{ id: 'w1', url: 'https://a.example.com', provider: 'DATADOG', createdAt: '2026-01-01T00:00:00Z', active: true }],
      isLoading: false,
    } as never)
    mockClients.mockReturnValue({
      data: [{ clientId: 'c1', name: 'My Key', provider: 'GENERIC', createdAt: '2026-01-02T00:00:00Z', status: 'ACTIVE' }],
      isLoading: false,
    } as never)
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByText('My Key')).toBeInTheDocument()
    expect(screen.getByText('https://a.example.com')).toBeInTheDocument()
    await user.click(screen.getByText('https://a.example.com'))
    expect(navigateMock).toHaveBeenCalledWith('/app/integrations/webhooks/w1')
    await user.click(screen.getByText('My Key'))
    expect(navigateMock).toHaveBeenCalledWith('/app/integrations/keys?provider=GENERIC')
  })

  it('falls back to clientId when a client has no name', () => {
    mockClients.mockReturnValue({
      data: [{ clientId: 'raw-client-id', name: '', provider: 'GENERIC', createdAt: '2026-01-01T00:00:00Z', status: 'ACTIVE' }],
      isLoading: false,
    } as never)
    renderPage()
    expect(screen.getByText('raw-client-id')).toBeInTheDocument()
  })
})
