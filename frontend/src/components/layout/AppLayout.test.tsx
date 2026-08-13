import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import uiReducer, { type UiState } from '@/features/ui/uiSlice'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUnreadNotificationsCountQuery } from '@/queries/useNotifications'
import { useMyOrgsQuery, useCreateOrgMembershipMutation } from '@/queries/useMyOrgs'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { AppLayout } from './AppLayout'

vi.mock('@/queries/useNotifications')
vi.mock('@/queries/useMyOrgs')

beforeAll(stubRadixEnvironment)
vi.mocked(useUnreadNotificationsCountQuery).mockReturnValue({ data: 0 } as never)
vi.mocked(useMyOrgsQuery).mockReturnValue({ data: [], isLoading: false, error: null } as never)
vi.mocked(useCreateOrgMembershipMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never)

function renderLayout(path: string, sidebarCollapsed = false) {
  const session: SessionState = { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' } }
  const ui: UiState = { themeMode: 'dark', autoTheme: false, sidebarCollapsed }
  const store = configureStore({
    reducer: { session: sessionReducer, ui: uiReducer },
    preloadedState: { session, ui },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <TooltipProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/app" element={<div>Dashboard content</div>} />
                <Route path="/app/settings" element={<div>Settings content</div>} />
              </Route>
            </Routes>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
    { container: document.body },
  )
}

describe('AppLayout', () => {
  it('renders the topbar, sidebar, routed content, and footer', () => {
    renderLayout('/app')
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
    expect(screen.getByText(/All systems monitored/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Incidents/ })).toBeInTheDocument()
  })

  it('collapses the sidebar automatically on first entering settings', () => {
    const { container } = renderLayout('/app/settings', false)
    expect(screen.getByText('Settings content')).toBeInTheDocument()
    const aside = container.querySelector('aside')
    expect(aside).toHaveStyle({ width: '72px' })
  })
})
