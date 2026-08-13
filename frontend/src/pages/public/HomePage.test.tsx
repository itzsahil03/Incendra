import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import { HomePage } from './HomePage'

function renderPage(session: SessionState) {
  const store = configureStore({ reducer: { session: sessionReducer }, preloadedState: { session } })
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('HomePage — logged out', () => {
  it('shows a call-to-action pointing at registration', () => {
    renderPage({ token: null, refreshToken: null, user: null })
    const ctas = screen.getAllByRole('link', { name: /Start your first response|Get started free/ })
    expect(ctas.length).toBeGreaterThan(0)
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/register'))
  })

  it('renders the feature grid and how-it-works steps', () => {
    renderPage({ token: null, refreshToken: null, user: null })
    expect(screen.getByText('Alert Ingestion')).toBeInTheDocument()
    expect(screen.getByText('Full Audit Trail')).toBeInTheDocument()
    expect(screen.getByText('Alerts come in')).toBeInTheDocument()
  })
})

describe('HomePage — logged in', () => {
  it('points calls-to-action at the dashboard instead', () => {
    renderPage({
      token: 't',
      refreshToken: 'r',
      user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' },
    })
    const ctas = screen.getAllByRole('link', { name: 'Go to Dashboard' })
    expect(ctas.length).toBeGreaterThan(0)
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/app'))
  })
})
