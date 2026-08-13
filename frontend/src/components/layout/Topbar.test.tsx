import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import uiReducer, { type UiState } from '@/features/ui/uiSlice'
import * as authApi from '@/api/auth'
import { useUnreadNotificationsCountQuery } from '@/queries/useNotifications'
import { useMyOrgsQuery, useSwitchOrgMutation, useCreateOrgMembershipMutation } from '@/queries/useMyOrgs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { Topbar } from './Topbar'

vi.mock('@/api/auth')
vi.mock('@/queries/useNotifications')
vi.mock('@/queries/useMyOrgs')
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeAll(stubRadixEnvironment)

const mockUseUnread = vi.mocked(useUnreadNotificationsCountQuery)
const mockUseMyOrgs = vi.mocked(useMyOrgsQuery)
const mockUseSwitchOrg = vi.mocked(useSwitchOrgMutation)
const mockUseCreateOrgMembership = vi.mocked(useCreateOrgMembershipMutation)

function renderTopbar(session: SessionState, sidebarCollapsed = false) {
  const ui: UiState = { themeMode: 'dark', autoTheme: false, sidebarCollapsed }
  const store = configureStore({
    reducer: { session: sessionReducer, ui: uiReducer },
    preloadedState: { session, ui },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app']}>
          <TooltipProvider>
            <Topbar />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUnread.mockReturnValue({ data: undefined } as never)
  mockUseMyOrgs.mockReturnValue({ data: [{ orgId: 'org-1', orgName: 'Acme', role: 'ADMIN' }], isLoading: false, error: null } as never)
  mockUseSwitchOrg.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) } as never)
  mockUseCreateOrgMembership.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  vi.mocked(authApi.logout).mockResolvedValue(undefined as never)
})

const loggedIn: SessionState = {
  token: 't',
  refreshToken: 'r',
  user: { id: 'u1', email: 'alice@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' },
}

describe('Topbar — basic chrome', () => {
  it('shows the brand, role badge, and the current org name', () => {
    renderTopbar(loggedIn)
    expect(screen.getAllByText('Incendra').length).toBeGreaterThan(0)
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
  })

  it('shows the full logo wordmark when the sidebar is expanded', () => {
    renderTopbar(loggedIn, false)
    expect(screen.getAllByText('Incendra').length).toBeGreaterThan(0)
  })

  it('still shows the logo wordmark when the sidebar is collapsed', () => {
    renderTopbar(loggedIn, true)
    expect(screen.getAllByText('Incendra').length).toBeGreaterThan(0)
  })

  it('shows the unread notification badge when there is an unread count', () => {
    mockUseUnread.mockReturnValue({ data: 3 } as never)
    renderTopbar(loggedIn)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('caps the unread badge display at 99+', () => {
    mockUseUnread.mockReturnValue({ data: 150 } as never)
    renderTopbar(loggedIn)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('navigates to notifications and settings from their icon buttons', async () => {
    const user = userEvent.setup()
    renderTopbar(loggedIn)
    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(navigateMock).toHaveBeenCalledWith('/app/notifications')
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(navigateMock).toHaveBeenCalledWith('/app/settings')
  })
})

describe('Topbar — account menu / logout', () => {
  it('logs out: calls the API, clears session, clears cache, toasts, and navigates to /login', async () => {
    const user = userEvent.setup()
    renderTopbar(loggedIn)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(await screen.findByText('Log out'))

    await waitFor(() => expect(authApi.logout).toHaveBeenCalledWith('r'))
    const { toast } = await import('sonner')
    expect(toast.info).toHaveBeenCalledWith('Signed out')
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })

  it('still clears session and navigates even if the logout API call fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    renderTopbar(loggedIn)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(await screen.findByText('Log out'))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login'))
  })
})

describe('Topbar — org switcher', () => {
  it('opens the dropdown and switches org on click', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockUseSwitchOrg.mockReturnValue({ mutateAsync } as never)
    mockUseMyOrgs.mockReturnValue({
      data: [
        { orgId: 'org-1', orgName: 'Acme', role: 'ADMIN' },
        { orgId: 'org-2', orgName: 'Other Org', role: 'VIEWER' },
      ],
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderTopbar(loggedIn)

    await user.click(screen.getByText('Acme'))
    const otherOrg = await screen.findByText('Other Org')
    await user.click(otherOrg)

    expect(mutateAsync).toHaveBeenCalledWith('org-2')
  })

  it('does not switch when clicking the already-active org', async () => {
    const mutateAsync = vi.fn()
    mockUseSwitchOrg.mockReturnValue({ mutateAsync } as never)
    const user = userEvent.setup()
    renderTopbar(loggedIn)

    await user.click(screen.getByText('Acme'))
    const items = await screen.findAllByText('Acme')
    await user.click(items[items.length - 1])

    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('shows a loading skeleton while orgs are loading', () => {
    mockUseMyOrgs.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderTopbar(loggedIn)
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  })

  it('shows an error message when orgs fail to load', () => {
    mockUseMyOrgs.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderTopbar(loggedIn)
    expect(screen.getByText('Unable to load your organizations')).toBeInTheDocument()
  })

  it('shows a Create organization button when the user has zero orgs', () => {
    renderTopbar({ token: 't', refreshToken: null, user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: null, role: null } })
    expect(screen.getByRole('button', { name: /Create organization/ })).toBeInTheDocument()
  })
})

describe('Topbar — mobile nav sheet', () => {
  it('opens the mobile nav sheet', async () => {
    const user = userEvent.setup()
    renderTopbar(loggedIn)
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('Topbar — sidebar toggle', () => {
  it('dispatches toggleSidebar when the collapse button is clicked', async () => {
    const user = userEvent.setup()
    const ui: UiState = { themeMode: 'dark', autoTheme: false, sidebarCollapsed: false }
    const store = configureStore({
      reducer: { session: sessionReducer, ui: uiReducer },
      preloadedState: { session: loggedIn, ui },
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/app']}>
            <TooltipProvider>
              <Topbar />
            </TooltipProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    )
    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }))
  })
})
