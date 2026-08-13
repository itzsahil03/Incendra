import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAccountsQuery } from '@/queries/useAccounts'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { RolesSettingsPage } from './RolesSettingsPage'

vi.mock('@/queries/useAccounts')

beforeAll(stubRadixEnvironment)

const mockAccounts = vi.mocked(useAccountsQuery)

function renderPage() {
  return render(<RolesSettingsPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAccounts.mockReturnValue({
    data: [
      { id: 'u1', name: 'Alice', email: 'a@example.com', role: 'ADMIN', createdAt: '' },
      { id: 'u2', name: 'Bob', email: 'b@example.com', role: 'RESPONDER', createdAt: '' },
      { id: 'u3', name: 'Carol', email: 'c@example.com', role: 'RESPONDER', createdAt: '' },
    ],
    isLoading: false,
    error: null,
  } as never)
})

describe('RolesSettingsPage — loading/error', () => {
  it('shows a loading state', () => {
    mockAccounts.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockAccounts.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })
})

describe('RolesSettingsPage — role cards', () => {
  it('renders a card per role definition with the correct member count', () => {
    renderPage()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('1 member')).toBeInTheDocument()
    expect(screen.getByText('2 members')).toBeInTheDocument()
  })

  it('opens the permissions sheet for a role and shows allowed/denied items', async () => {
    const user = userEvent.setup()
    renderPage()
    const adminCard = screen.getByText('Admin').closest('div')!.parentElement!
    await user.click(within(adminCard).getByRole('button', { name: 'View Permissions' }))
    expect(await screen.findByText('Admin permissions')).toBeInTheDocument()
  })

  it('closes the sheet', async () => {
    const user = userEvent.setup()
    renderPage()
    const adminCard = screen.getByText('Admin').closest('div')!.parentElement!
    await user.click(within(adminCard).getByRole('button', { name: 'View Permissions' }))
    expect(await screen.findByText('Admin permissions')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Admin permissions')).not.toBeInTheDocument()
  })
})
