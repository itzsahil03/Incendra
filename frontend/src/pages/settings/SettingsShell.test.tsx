import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type Role } from '@/features/session/sessionSlice'
import { SettingsShell } from './SettingsShell'

function renderShell(role: Role, path = '/app/settings/general') {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session: { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role } } },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/settings" element={<SettingsShell />}>
            <Route path="general" element={<div>General content</div>} />
            <Route path="roles" element={<div>Roles content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe('SettingsShell', () => {
  it('renders both nav sections and the routed content for an admin', () => {
    renderShell('ADMIN')
    expect(screen.getAllByText('Organization').length).toBeGreaterThan(0)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /General/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Roles & Permissions/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Profile/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Change Password/ })).toBeInTheDocument()
    expect(screen.getByText('General content')).toBeInTheDocument()
  })

  it('hides the ADMIN-only Roles & Permissions link for a non-admin', () => {
    renderShell('VIEWER')
    expect(screen.queryByRole('link', { name: /Roles & Permissions/ })).not.toBeInTheDocument()
  })

  it('marks the active link', () => {
    renderShell('ADMIN', '/app/settings/roles')
    expect(screen.getByRole('link', { name: /Roles & Permissions/ })).toHaveClass('bg-accent')
  })
})
