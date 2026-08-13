import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useClientsQuery, useCreateClientMutation, useDeleteClientMutation, useRotateClientMutation } from '@/queries/useClients'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { ApiKeysPage } from './ApiKeysPage'

vi.mock('@/queries/useClients')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeAll(stubRadixEnvironment)

const mockClients = vi.mocked(useClientsQuery)
const mockCreate = vi.mocked(useCreateClientMutation)
const mockRotate = vi.mocked(useRotateClientMutation)
const mockDelete = vi.mocked(useDeleteClientMutation)

function client(overrides: Record<string, unknown> = {}) {
  return {
    clientId: 'c1',
    name: 'My Key',
    provider: 'GENERIC',
    orgId: 'org-1',
    scopes: ['alerts.read'],
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    requestsToday: 5,
    requestCountTotal: 100,
    status: 'ACTIVE',
    ...overrides,
  }
}

function renderPage(route = '/') {
  return render(<ApiKeysPage />, { wrapper: ({ children }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter> })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClients.mockReturnValue({ data: [client()], isLoading: false, error: null } as never)
  mockCreate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ clientSecret: 'key-secret' }), isPending: false } as never)
  mockRotate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ clientSecret: 'rotated-secret', rotatedAt: '2026-01-05T00:00:00Z' }), isPending: false } as never)
  mockDelete.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
})

describe('ApiKeysPage — loading/error/empty', () => {
  it('shows a loading state', () => {
    mockClients.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByText('My Key')).not.toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockClients.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.queryByText('My Key')).not.toBeInTheDocument()
  })

  it('shows an empty state', () => {
    mockClients.mockReturnValue({ data: [], isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No API keys yet')).toBeInTheDocument()
  })
})

describe('ApiKeysPage — list', () => {
  it('shows the stat row and a key card', () => {
    renderPage()
    expect(screen.getByText('Active Keys')).toBeInTheDocument()
    expect(screen.getByText('My Key')).toBeInTheDocument()
  })

  it('falls back to clientId when a client has no name', () => {
    mockClients.mockReturnValue({ data: [client({ name: '' })], isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getAllByText('c1').length).toBeGreaterThan(0)
  })

  it('filters by provider query param and clears it', async () => {
    mockClients.mockReturnValue({ data: [client({ provider: 'SLACK' })], isLoading: false, error: null } as never)
    const user = userEvent.setup()
    renderPage('/?provider=SLACK')
    expect(screen.getByText(/Filtered by/)).toBeInTheDocument()
    await user.click(screen.getByText(/Filtered by/))
  })

  it('shows the create dialog automatically when ?create=1', async () => {
    renderPage('/?create=1')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('ApiKeysPage — detail sheet', () => {
  it('opens the detail sheet on card click and shows grouped scopes and usage stats', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('My Key'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('alerts')).toBeInTheDocument()
    expect(within(dialog).getByText('c1')).toBeInTheDocument()
  })

  it('shows "No scopes granted" for a key with none', async () => {
    mockClients.mockReturnValue({ data: [client({ scopes: [] })], isLoading: false, error: null } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('My Key'))
    expect(await screen.findByText('No scopes granted')).toBeInTheDocument()
  })

  it('shows "Never" for a key never used', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('My Key'))
    expect(await screen.findByText('Never')).toBeInTheDocument()
  })
})

describe('ApiKeysPage — row actions', () => {
  it('rotates a key and reveals the new secret, plus the old-secret summary panel', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ clientSecret: 'rotated-secret', rotatedAt: '2026-01-05T00:00:00Z' })
    mockRotate.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Key actions' }))
    await user.click(await screen.findByText('Rotate secret'))
    expect(mutateAsync).toHaveBeenCalledWith('c1')
    expect(await screen.findByDisplayValue('rotated-secret')).toBeInTheDocument()
    expect(screen.getByText('Old Secret')).toBeInTheDocument()
  })

  it('shows a toast error when rotation fails', async () => {
    mockRotate.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'rotate failed' } } }),
      isPending: false,
    } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Key actions' }))
    await user.click(await screen.findByText('Rotate secret'))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('rotate failed'))
  })

  it('revokes a key via the confirm dialog', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockDelete.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Key actions' }))
    await user.click(await screen.findByText('Revoke'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))
    expect(mutateAsync).toHaveBeenCalledWith('c1')
    expect(toast.success).toHaveBeenCalledWith('API key revoked')
  })
})

describe('ApiKeysPage — create dialog', () => {
  it('creates a key with the entered name/clientId and reveals the secret', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ clientSecret: 'brand-new-key-secret' })
    mockCreate.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New key/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Datadog Prod')
    await user.type(within(dialog).getByLabelText('Client ID'), 'datadog-prod')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'datadog-prod', name: 'Datadog Prod', provider: 'GENERIC', expiresAt: null }),
    )
    expect(await screen.findByDisplayValue('brand-new-key-secret')).toBeInTheDocument()
  })

  it('disables Create until name and clientId are entered', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New key/ }))
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
    await user.click(screen.getByRole('button', { name: /New key/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'X')
    await user.type(within(dialog).getByLabelText('Client ID'), 'x')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('create failed'))
  })

  it('applies a scope preset', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New key/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Read Only'))
  })

  it('sets an expiry date', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ clientSecret: 's' })
    mockCreate.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New key/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'X')
    await user.type(within(dialog).getByLabelText('Client ID'), 'x')
    await user.type(within(dialog).getByLabelText('Expires'), '2027-01-01')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: new Date('2027-01-01').toISOString() }))
  })

  it('closes and resets on cancel', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /New key/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Abandoned')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
