import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import sessionReducer from '@/features/session/sessionSlice'
import type { Role } from '@/features/session/sessionSlice'
import { RoleGate } from './RoleGate'

function renderWithRole(role: Role | null, ui: React.ReactElement) {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: {
        token: 't',
        refreshToken: 'r',
        user: role ? { id: 'u1', email: 'u1@example.com', name: 'U1', orgId: 'org-1', role } : null,
      },
    },
  })
  return render(<Provider store={store}>{ui}</Provider>)
}

describe('RoleGate', () => {
  it('renders children when the role is allowed', () => {
    renderWithRole('ADMIN', (
      <RoleGate allow={['ADMIN']}>
        <p>Admin only content</p>
      </RoleGate>
    ))
    expect(screen.getByText('Admin only content')).toBeInTheDocument()
  })

  it('renders nothing by default when the role is not allowed', () => {
    renderWithRole('VIEWER', (
      <RoleGate allow={['ADMIN']}>
        <p>Admin only content</p>
      </RoleGate>
    ))
    expect(screen.queryByText('Admin only content')).not.toBeInTheDocument()
  })

  it('renders the fallback when provided and role is not allowed', () => {
    renderWithRole('VIEWER', (
      <RoleGate allow={['ADMIN']} fallback={<p>No access</p>}>
        <p>Admin only content</p>
      </RoleGate>
    ))
    expect(screen.getByText('No access')).toBeInTheDocument()
    expect(screen.queryByText('Admin only content')).not.toBeInTheDocument()
  })

  it('renders nothing when there is no user/role at all', () => {
    renderWithRole(null, (
      <RoleGate allow={['ADMIN', 'RESPONDER', 'VIEWER']}>
        <p>Admin only content</p>
      </RoleGate>
    ))
    expect(screen.queryByText('Admin only content')).not.toBeInTheDocument()
  })
})
