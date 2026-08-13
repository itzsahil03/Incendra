import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import sessionReducer from '@/features/session/sessionSlice'
import type { SessionUser } from '@/features/session/sessionSlice'
import { NotFoundPage } from './NotFoundPage'

function renderPage({ user = null }: { user?: SessionUser | null } = {}) {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: { token: user ? 't' : null, refreshToken: user ? 'r' : null, user },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter>{children}</MemoryRouter>
      </Provider>
    )
  }

  return render(<NotFoundPage />, { wrapper: Wrapper })
}

describe('NotFoundPage', () => {
  it('shows the 404 message', () => {
    renderPage()
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText("This page doesn't exist.")).toBeInTheDocument()
  })

  it('links to the marketing home when logged out', () => {
    renderPage({ user: null })
    const link = screen.getByRole('link', { name: 'Back home' })
    expect(link).toHaveAttribute('href', '/')
  })

  it('links to the app dashboard when logged in', () => {
    renderPage({ user: { id: 'u1', email: 'a@b.com', name: 'Ada', orgId: 'org-1', role: 'ADMIN' } })
    const link = screen.getByRole('link', { name: 'Back to dashboard' })
    expect(link).toHaveAttribute('href', '/app')
  })
})
