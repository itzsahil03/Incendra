import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import {
  useCreateWebhookMutation,
  useDeleteWebhookMutation,
  useUpdateWebhookMutation,
  useWebhooksQuery,
} from '@/queries/useWebhooks'
import { useHealthSummaryQuery, useSendTestDeliveryMutation, useWebhookStatsQuery } from '@/queries/useWebhookDeliveries'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { WebhooksPage } from './WebhooksPage'

vi.mock('@/queries/useWebhooks')
vi.mock('@/queries/useWebhookDeliveries')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeAll(stubRadixEnvironment)

const mockWebhooks = vi.mocked(useWebhooksQuery)
const mockStats = vi.mocked(useWebhookStatsQuery)
const mockHealthSummary = vi.mocked(useHealthSummaryQuery)
const mockUpdate = vi.mocked(useUpdateWebhookMutation)
const mockDelete = vi.mocked(useDeleteWebhookMutation)
const mockSendTest = vi.mocked(useSendTestDeliveryMutation)
const mockCreate = vi.mocked(useCreateWebhookMutation)

function webhook(overrides: Record<string, unknown> = {}) {
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
  return render(<WebhooksPage />, { wrapper: MemoryRouter })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWebhooks.mockReturnValue({ data: [webhook()], isLoading: false, error: null } as never)
  mockStats.mockReturnValue({ data: { deliveriesToday: 3, failuresToday: 1, avgLatencyMsToday: 150 } } as never)
  mockHealthSummary.mockReturnValue({ data: {} } as never)
  mockUpdate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockDelete.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockSendTest.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockCreate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ secret: 'wh-secret' }), isPending: false } as never)
})

describe('WebhooksPage — loading/error/empty', () => {
  it('shows a loading state', () => {
    mockWebhooks.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByText('https://example.com/hook')).not.toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockWebhooks.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.queryByText('https://example.com/hook')).not.toBeInTheDocument()
  })

  it('shows an empty state with no webhooks', () => {
    mockWebhooks.mockReturnValue({ data: [], isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No webhooks configured')).toBeInTheDocument()
  })
})

describe('WebhooksPage — list', () => {
  it('shows the stat row and a webhook card', () => {
    renderPage()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('https://example.com/hook')).toBeInTheDocument()
  })

  it('navigates to the detail page on card click', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('https://example.com/hook'))
    expect(navigateMock).toHaveBeenCalledWith('w1')
  })

  it('shows the filtered-by-provider chip and clears it', async () => {
    mockWebhooks.mockReturnValue({ data: [webhook({ provider: 'SLACK' })], isLoading: false, error: null } as never)
    const user = userEvent.setup()
    render(<WebhooksPage />, { wrapper: ({ children }) => <MemoryRouter initialEntries={['/?provider=SLACK']}>{children}</MemoryRouter> })
    expect(screen.getByText(/Filtered by/)).toBeInTheDocument()
    await user.click(screen.getByText(/Filtered by/))
  })

  it('shows the create dialog automatically when ?create=1', async () => {
    render(<WebhooksPage />, { wrapper: ({ children }) => <MemoryRouter initialEntries={['/?create=1']}>{children}</MemoryRouter> })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('WebhooksPage — row actions', () => {
  it('toggles active state', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockUpdate.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('switch'))
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'w1', active: false })
  })

  it('sends a test event from the row menu', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockSendTest.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Webhook actions' }))
    await user.click(await screen.findByText('Send test event'))
    expect(mutateAsync).toHaveBeenCalledWith('w1')
    expect(toast.success).toHaveBeenCalledWith('Test event sent — check the delivery log for the result')
  })

  it('deletes a webhook via the confirm dialog', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockDelete.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Webhook actions' }))
    await user.click(await screen.findByText('Delete'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(mutateAsync).toHaveBeenCalledWith('w1')
    expect(toast.success).toHaveBeenCalledWith('Webhook deleted')
  })

  it('shows health pills based on webhook health summary', () => {
    mockHealthSummary.mockReturnValue({ data: { w1: { status: 'Healthy', successRate24h: 99, avgLatencyMs24h: 80, lastDeliveryAt: null } } } as never)
    renderPage()
    expect(screen.getByText(/Healthy/)).toBeInTheDocument()
  })

  it('shows "No deliveries yet" when there is no health data', () => {
    renderPage()
    expect(screen.getByText('No deliveries yet')).toBeInTheDocument()
  })
})

describe('WebhooksPage — filter bar (more than 5 webhooks)', () => {
  const many = Array.from({ length: 6 }, (_, i) => webhook({ id: `w${i}`, url: `https://example.com/hook-${i}` }))

  it('shows the filter bar and filters by search text', async () => {
    mockWebhooks.mockReturnValue({ data: many, isLoading: false, error: null } as never)
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByPlaceholderText('Search webhooks…')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Search webhooks…'), 'hook-3')
    expect(screen.getByText('https://example.com/hook-3')).toBeInTheDocument()
    expect(screen.queryByText('https://example.com/hook-0')).not.toBeInTheDocument()
  })

  it('shows a no-match message', async () => {
    mockWebhooks.mockReturnValue({ data: many, isLoading: false, error: null } as never)
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText('Search webhooks…'), 'nonexistent-xyz')
    expect(screen.getByText('No webhooks match your search or filters.')).toBeInTheDocument()
  })

  it('hides the filter bar with 5 or fewer webhooks', () => {
    renderPage()
    expect(screen.queryByPlaceholderText('Search webhooks…')).not.toBeInTheDocument()
  })
})

describe('WebhooksPage — create dialog', () => {
  it('creates a webhook and reveals the secret', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ secret: 'brand-new-secret' })
    mockCreate.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New webhook/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('URL'), 'https://new.example.com/hook')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(mutateAsync).toHaveBeenCalledWith({ url: 'https://new.example.com/hook', subscribedTopics: [], provider: 'GENERIC' })
    expect(await screen.findByDisplayValue('brand-new-secret')).toBeInTheDocument()
  })

  it('disables Create until a URL is entered', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New webhook/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Create' })).toBeDisabled()
  })

  it('shows a toast error when creation fails', async () => {
    mockCreate.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'create failed' } } }),
      isPending: false,
    } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New webhook/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('URL'), 'https://new.example.com/hook')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('create failed'))
  })

  it('picks a provider and updates default topics', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New webhook/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: /Slack/ }))
  })

  it('closes and resets on cancel', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New webhook/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('URL'), 'https://abandoned.example.com')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
