import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import { ProtectedRoute } from './ProtectedRoute'

function renderWithSession(session: SessionState, initialPath = '/app', allowedRoles?: ('ADMIN' | 'RESPONDER' | 'VIEWER')[]) {
  const store = configureStore({ reducer: { session: sessionReducer }, preloadedState: { session } })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/app" element={<div>App Home (redirect target)</div>} />
          <Route path="/admin-only" element={<ProtectedRoute allowedRoles={allowedRoles} />}>
            <Route index element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no user', () => {
    renderWithSession({ token: null, refreshToken: null, user: null }, '/admin-only')
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders the protected content (Outlet) when a user is present and no role restriction applies', () => {
    renderWithSession(
      { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Ada', orgId: 'org-1', role: 'VIEWER' } },
      '/admin-only',
    )
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('renders content when the user role is in allowedRoles', () => {
    renderWithSession(
      { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Ada', orgId: 'org-1', role: 'ADMIN' } },
      '/admin-only',
      ['ADMIN', 'RESPONDER'],
    )
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to /app when the user role is not in allowedRoles', () => {
    renderWithSession(
      { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Ada', orgId: 'org-1', role: 'VIEWER' } },
      '/admin-only',
      ['ADMIN'],
    )
    expect(screen.getByText('App Home (redirect target)')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('redirects away (does not render content) when the user has no role at all', () => {
    renderWithSession(
      { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Ada', orgId: 'org-1', role: null } },
      '/admin-only',
      ['ADMIN'],
    )
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.getByText('App Home (redirect target)')).toBeInTheDocument()
  })
})
