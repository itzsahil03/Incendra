import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type Role, type SessionState } from '@/features/session/sessionSlice'
import uiReducer, { type UiState } from '@/features/ui/uiSlice'
import { TooltipProvider } from '@/components/ui/tooltip'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { Sidebar } from './Sidebar'

beforeAll(stubRadixEnvironment)

function renderSidebar(open: boolean, role: Role | null = 'ADMIN') {
  const session: SessionState = { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role } }
  const ui: UiState = { themeMode: 'dark', autoTheme: false, sidebarCollapsed: !open }
  const store = configureStore({
    reducer: { session: sessionReducer, ui: uiReducer },
    preloadedState: { session, ui },
  })
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/app']}>
        <TooltipProvider>
          <Sidebar open={open} />
        </TooltipProvider>
      </MemoryRouter>
    </Provider>,
  )
  return store
}

describe('Sidebar', () => {
  it('renders every nav item an ADMIN can see, including Integrations', () => {
    renderSidebar(true, 'ADMIN')
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Incidents/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alerts/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Activity/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Analytics/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Integrations/ })).toBeInTheDocument()
  })

  it('hides Integrations for a non-admin role', () => {
    renderSidebar(true, 'RESPONDER')
    expect(screen.queryByRole('link', { name: /Integrations/ })).not.toBeInTheDocument()
  })

  it('shows the workspace label only when expanded', () => {
    renderSidebar(true)
    expect(screen.getByText('Workspace')).toBeInTheDocument()
  })

  it('hides the workspace label when collapsed and not hovered', () => {
    renderSidebar(false)
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
  })

  it('expands on hover even when collapsed', async () => {
    const user = userEvent.setup()
    renderSidebar(false)
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
    await user.hover(screen.getByRole('link', { name: /Dashboard/ }).closest('aside')!)
    expect(screen.getByText('Workspace')).toBeInTheDocument()
  })

  it('toggles collapse state via the collapse/expand button', async () => {
    const user = userEvent.setup()
    const store = renderSidebar(true)
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(store.getState().ui.sidebarCollapsed).toBe(true)
  })

  it('shows an expand label on the toggle button when collapsed', () => {
    renderSidebar(false)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })
})
