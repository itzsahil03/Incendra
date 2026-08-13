import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { PublicHeader } from './PublicHeader'

beforeAll(stubRadixEnvironment)

function renderHeader(session: SessionState) {
  const store = configureStore({ reducer: { session: sessionReducer }, preloadedState: { session } })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <PublicHeader />
      </MemoryRouter>
    </Provider>,
  )
}

describe('PublicHeader — logged out', () => {
  it('shows Log in / Get Started links', () => {
    renderHeader({ token: null, refreshToken: null, user: null })
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register')
    expect(screen.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument()
  })

  it('renders the nav links', () => {
    renderHeader({ token: null, refreshToken: null, user: null })
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/services')
    expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact')
  })
})

describe('PublicHeader — logged in with an org', () => {
  it('shows a Go to Dashboard link instead of login/register', () => {
    renderHeader({
      token: 't',
      refreshToken: 'r',
      user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' },
    })
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/app')
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
  })
})

describe('PublicHeader — logged in with zero orgs', () => {
  it('shows neither the dashboard link nor login/register', () => {
    renderHeader({
      token: 't',
      refreshToken: null,
      user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: null, role: null },
    })
    expect(screen.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
  })
})

describe('PublicHeader — mobile menu', () => {
  it('opens the sheet nav on menu click, showing the nav links and a Get Started CTA', async () => {
    const user = userEvent.setup()
    renderHeader({ token: null, refreshToken: null, user: null })

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(within(dialog).getByRole('link', { name: 'Services' })).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Get Started' })).toBeInTheDocument()
  })

  it('shows a Go to Dashboard CTA in the mobile sheet for a user with an org', async () => {
    const user = userEvent.setup()
    renderHeader({
      token: 't',
      refreshToken: 'r',
      user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' },
    })
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/app')
  })
})
