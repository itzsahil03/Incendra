import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import sessionReducer from '@/features/session/sessionSlice'
import type { Role } from '@/features/session/sessionSlice'
import { MembersPage } from './MembersPage'
import { useAccountsQuery, useRemoveMemberMutation, useUpdateAccountRoleMutation } from '@/queries/useAccounts'
import type { UserAccountResponse } from '@/api/auth'
import dayjs from '@/lib/dayjs'

vi.mock('@/queries/useAccounts')
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false) as unknown as typeof Element.prototype.hasPointerCapture
  Element.prototype.releasePointerCapture = vi.fn() as unknown as typeof Element.prototype.releasePointerCapture
})

const mockUseAccountsQuery = vi.mocked(useAccountsQuery)
const mockUseRemoveMemberMutation = vi.mocked(useRemoveMemberMutation)
const mockUseUpdateAccountRoleMutation = vi.mocked(useUpdateAccountRoleMutation)

function buildAccount(overrides: Partial<UserAccountResponse> = {}): UserAccountResponse {
  return {
    id: 'u1',
    email: 'alice@example.com',
    name: 'Alice',
    role: 'RESPONDER',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage({
  role = 'ADMIN' as Role,
  currentUserId = 'me',
  accounts,
  isLoading = false,
  error = null as unknown,
  removeMutateAsync = vi.fn().mockResolvedValue(undefined),
  removePending = false,
  updateRoleMutateAsync = vi.fn().mockResolvedValue(undefined),
}: {
  role?: Role
  currentUserId?: string
  accounts?: UserAccountResponse[]
  isLoading?: boolean
  error?: unknown
  removeMutateAsync?: ReturnType<typeof vi.fn>
  removePending?: boolean
  updateRoleMutateAsync?: ReturnType<typeof vi.fn>
} = {}) {
  mockUseAccountsQuery.mockReturnValue({ data: accounts, isLoading, error } as unknown as ReturnType<typeof useAccountsQuery>)
  mockUseRemoveMemberMutation.mockReturnValue({
    mutateAsync: removeMutateAsync,
    isPending: removePending,
  } as unknown as ReturnType<typeof useRemoveMemberMutation>)
  mockUseUpdateAccountRoleMutation.mockReturnValue({
    mutateAsync: updateRoleMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateAccountRoleMutation>)

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: {
        token: 't',
        refreshToken: 'r',
        user: { id: currentUserId, email: 'me@example.com', name: 'Me', orgId: 'org-1', role },
      },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    )
  }

  return render(<MembersPage />, { wrapper: Wrapper })
}

describe('MembersPage — loading, error, empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while accounts load', () => {
    renderPage({ isLoading: true, accounts: undefined })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error state when the query fails', () => {
    renderPage({ error: { isAxiosError: true, response: { data: { message: 'Cannot load members' } } } })
    expect(screen.getByText('Cannot load members')).toBeInTheDocument()
  })

  it('renders the members table for a small org without the filter bar', () => {
    renderPage({ accounts: [buildAccount({ id: 'u1', name: 'Alice' }), buildAccount({ id: 'u2', name: 'Bob' })] })
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search members…')).not.toBeInTheDocument()
  })
})

describe('MembersPage — filter bar (>5 members)', () => {
  const manyAccounts = Array.from({ length: 6 }, (_, i) =>
    buildAccount({ id: `u${i}`, name: `Member ${i}`, email: `member${i}@example.com`, role: i === 0 ? 'ADMIN' : 'RESPONDER' }),
  )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the filter bar once there are more than 5 members', () => {
    renderPage({ accounts: manyAccounts })
    expect(screen.getByPlaceholderText('Search members…')).toBeInTheDocument()
  })

  it('filters by search text on name or email', async () => {
    const user = userEvent.setup()
    renderPage({ accounts: manyAccounts })

    await user.type(screen.getByPlaceholderText('Search members…'), 'Member 3')
    expect(screen.getByText('Member 3')).toBeInTheDocument()
    expect(screen.queryByText('Member 4')).not.toBeInTheDocument()
  })

  it('shows the no-match message when filters exclude everything', async () => {
    const user = userEvent.setup()
    renderPage({ accounts: manyAccounts })

    await user.type(screen.getByPlaceholderText('Search members…'), 'nobody-matches-this')
    expect(screen.getByText('No members match your search or filters.')).toBeInTheDocument()
  })

  it('filters by role', async () => {
    const user = userEvent.setup()
    renderPage({ accounts: manyAccounts })

    await user.click(screen.getAllByRole('combobox')[0])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('ADMIN'))

    expect(screen.getByText('Member 0')).toBeInTheDocument()
    expect(screen.queryByText('Member 1')).not.toBeInTheDocument()
  })

  it('filters by joined-date range and clears the range', async () => {
    const user = userEvent.setup()
    const accounts = [
      buildAccount({ id: 'old', name: 'Old Member', createdAt: '2020-01-01T00:00:00Z' }),
      ...manyAccounts,
    ]
    renderPage({ accounts })

    await user.type(screen.getByLabelText('Joined from'), '2025-01-01')
    expect(screen.queryByText('Old Member')).not.toBeInTheDocument()
    expect(screen.getByText('Member 0')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText('Old Member')).toBeInTheDocument()
  })
})

describe('MembersPage — role change (admin only)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets an admin change another member’s role via the select', async () => {
    const user = userEvent.setup()
    const updateRoleMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderPage({
      role: 'ADMIN',
      currentUserId: 'me',
      accounts: [buildAccount({ id: 'u1', name: 'Alice', role: 'RESPONDER' })],
      updateRoleMutateAsync,
    })

    await user.click(screen.getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('ADMIN'))

    expect(updateRoleMutateAsync).toHaveBeenCalledWith({ id: 'u1', role: 'ADMIN' })
  })

  it('shows a toast error when the role update fails', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const updateRoleMutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Cannot demote yourself' } },
    })
    renderPage({
      role: 'ADMIN',
      accounts: [buildAccount({ id: 'u1', name: 'Alice', role: 'RESPONDER' })],
      updateRoleMutateAsync,
    })

    await user.click(screen.getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('VIEWER'))

    expect(toast.error).toHaveBeenCalledWith('Cannot demote yourself')
  })

  it('shows a read-only badge instead of a select for the current user’s own row', () => {
    renderPage({ role: 'ADMIN', currentUserId: 'me', accounts: [buildAccount({ id: 'me', name: 'Me', role: 'ADMIN' })] })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })

  it('shows a read-only badge for a non-admin viewer', () => {
    renderPage({ role: 'RESPONDER', accounts: [buildAccount({ id: 'u1', name: 'Alice', role: 'RESPONDER' })] })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('marks the current user’s own row with "(you)"', () => {
    renderPage({ role: 'RESPONDER', currentUserId: 'me', accounts: [buildAccount({ id: 'me', name: 'Me' })] })
    expect(screen.getByText('(you)')).toBeInTheDocument()
  })
})

describe('MembersPage — remove member flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the remove button only for admins, and not on their own row', () => {
    renderPage({
      role: 'ADMIN',
      currentUserId: 'me',
      accounts: [buildAccount({ id: 'me', name: 'Me' }), buildAccount({ id: 'u2', name: 'Bob' })],
    })
    expect(screen.queryByRole('button', { name: 'Remove Me' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Bob' })).toBeInTheDocument()
  })

  it('hides remove buttons entirely for a non-admin', () => {
    renderPage({ role: 'VIEWER', accounts: [buildAccount({ id: 'u2', name: 'Bob' })] })
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('opens a confirm dialog and removes the member on confirm', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const removeMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderPage({ role: 'ADMIN', accounts: [buildAccount({ id: 'u2', name: 'Bob' })], removeMutateAsync })

    await user.click(screen.getByRole('button', { name: 'Remove Bob' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Remove Bob from this organization?')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(removeMutateAsync).toHaveBeenCalledWith('u2')
    expect(toast.success).toHaveBeenCalledWith('Removed from the org')
  })

  it('shows a toast error and closes the dialog when removal fails', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const removeMutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Cannot remove the last admin' } },
    })
    renderPage({ role: 'ADMIN', accounts: [buildAccount({ id: 'u2', name: 'Bob' })], removeMutateAsync })

    await user.click(screen.getByRole('button', { name: 'Remove Bob' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(toast.error).toHaveBeenCalledWith('Cannot remove the last admin')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('cancels the remove dialog without mutating', async () => {
    const user = userEvent.setup()
    const removeMutateAsync = vi.fn()
    renderPage({ role: 'ADMIN', accounts: [buildAccount({ id: 'u2', name: 'Bob' })], removeMutateAsync })

    await user.click(screen.getByRole('button', { name: 'Remove Bob' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(removeMutateAsync).not.toHaveBeenCalled()
  })
})

describe('MembersPage — table cell rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email and formatted joined date', () => {
    renderPage({
      role: 'VIEWER',
      accounts: [buildAccount({ id: 'u1', name: 'Alice', email: 'alice@example.com', createdAt: '2024-06-15T00:00:00Z' })],
    })
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText(dayjs('2024-06-15T00:00:00Z').format('MMM D, YYYY'))).toBeInTheDocument()
  })
})
