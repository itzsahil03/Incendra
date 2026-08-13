import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useClientsQuery } from '@/queries/useClients'
import { useWebhooksQuery } from '@/queries/useWebhooks'
import { useLastActivityQuery } from '@/queries/useWebhookDeliveries'
import { ConnectedAppsPage } from './ConnectedAppsPage'
import { PROVIDERS } from '@/lib/providers'

vi.mock('@/queries/useClients')
vi.mock('@/queries/useWebhooks')
vi.mock('@/queries/useWebhookDeliveries')

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const mockClients = vi.mocked(useClientsQuery)
const mockWebhooks = vi.mocked(useWebhooksQuery)
const mockLastActivity = vi.mocked(useLastActivityQuery)

function renderPage() {
  return render(<ConnectedAppsPage />, { wrapper: MemoryRouter })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClients.mockReturnValue({ data: [], isLoading: false } as never)
  mockWebhooks.mockReturnValue({ data: [], isLoading: false } as never)
  mockLastActivity.mockReturnValue({ data: {} } as never)
})

describe('ConnectedAppsPage', () => {
  it('shows a loading state', () => {
    mockClients.mockReturnValue({ data: undefined, isLoading: true } as never)
    renderPage()
    expect(screen.queryByText('Connected Apps')).not.toBeInTheDocument()
  })

  it('renders a card for every provider in the registry', () => {
    renderPage()
    expect(screen.getByText('Connected Apps')).toBeInTheDocument()
    expect(screen.getAllByText(/Key|Webhook|Datadog|Slack|Generic/i).length).toBeGreaterThan(0)
  })

  it('shows connection counts and last-activity for a connected provider, and navigates to view keys/webhooks', async () => {
    const provider = PROVIDERS[0]
    mockClients.mockReturnValue({
      data: [{ clientId: 'c1', provider, lastUsedAt: '2026-01-01T00:00:00Z', status: 'ACTIVE' }],
      isLoading: false,
    } as never)
    mockWebhooks.mockReturnValue({
      data: [{ id: 'w1', provider, active: true, createdAt: '2026-01-01T00:00:00Z' }],
      isLoading: false,
    } as never)
    mockLastActivity.mockReturnValue({ data: { w1: '2026-01-02T00:00:00Z' } } as never)
    const user = userEvent.setup()
    renderPage()

    const viewKeysButtons = screen.getAllByRole('button', { name: 'View Keys' })
    expect(viewKeysButtons.length).toBeGreaterThan(0)
    await user.click(viewKeysButtons[0])
    expect(navigateMock).toHaveBeenCalledWith(`/app/integrations/keys?provider=${provider}`)

    const viewWebhooksButtons = screen.getAllByRole('button', { name: 'View Webhooks' })
    await user.click(viewWebhooksButtons[0])
    expect(navigateMock).toHaveBeenCalledWith(`/app/integrations/webhooks?provider=${provider}`)
  })
})
