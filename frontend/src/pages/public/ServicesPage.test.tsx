import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import { ServicesPage } from './ServicesPage'

function renderPage(session: SessionState) {
  const store = configureStore({ reducer: { session: sessionReducer }, preloadedState: { session } })
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('ServicesPage — logged out', () => {
  it('lists every service and a register CTA', () => {
    renderPage({ token: null, refreshToken: null, user: null })
    expect(screen.getByText('Alert Ingestion')).toBeInTheDocument()
    expect(screen.getByText('Outbound Webhooks')).toBeInTheDocument()
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Get started free/ })).toHaveAttribute('href', '/register')
  })
})

describe('ServicesPage — logged in', () => {
  it('points the CTA at the dashboard', () => {
    renderPage({
      token: 't',
      refreshToken: 'r',
      user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' },
    })
    expect(screen.getByRole('link', { name: /Go to Dashboard/ })).toHaveAttribute('href', '/app')
  })
})
