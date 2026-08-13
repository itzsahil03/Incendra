import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import sessionReducer from '@/features/session/sessionSlice'
import { LoginPage } from './LoginPage'
import * as authApi from '@/api/auth'

vi.mock('@/api/auth')

const mockLogin = vi.mocked(authApi.login)

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
})

function renderLoginPage({
  initialEntry = '/login',
}: {
  initialEntry?: string | { pathname: string; state?: unknown }
} = {}) {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session: { token: null, refreshToken: null, user: null } },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<div>APP_DASHBOARD_MARKER</div>} />
          <Route path="/incidents/42" element={<div>INCIDENT_42_MARKER</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('shows the membership-changed notice when ?reason=membership_inactive is present', () => {
    renderLoginPage({ initialEntry: '/login?reason=membership_inactive' })
    expect(screen.getByText(/Your access to that organization has changed/)).toBeInTheDocument()
  })

  it('logs in and navigates to /app by default', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({
      token: 'tok',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'user@example.com', name: 'User', orgId: 'org-1', role: 'ADMIN' },
    })
    renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('APP_DASHBOARD_MARKER')).toBeInTheDocument()
    expect(mockLogin).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password123' })
  })

  it('redirects to the original "from" location after login', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({
      token: 'tok',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'user@example.com', name: 'User', orgId: 'org-1', role: 'ADMIN' },
    })
    renderLoginPage({ initialEntry: { pathname: '/login', state: { from: { pathname: '/incidents/42' } } } })

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('INCIDENT_42_MARKER')).toBeInTheDocument()
  })

  it('shows a server error and hides the membership notice when login fails', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Invalid email or password' } },
    })
    renderLoginPage({ initialEntry: '/login?reason=membership_inactive' })

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(screen.queryByText(/Your access to that organization has changed/)).not.toBeInTheDocument()
    expect(screen.queryByText('APP_DASHBOARD_MARKER')).not.toBeInTheDocument()
  })

  it('shows a submitting state while the request is in flight', async () => {
    const user = userEvent.setup()
    let resolveLogin: (v: unknown) => void = () => {}
    mockLogin.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve
      }) as unknown as ReturnType<typeof authApi.login>,
    )
    renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled()

    resolveLogin({
      token: 'tok',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'user@example.com', name: 'User', orgId: 'org-1', role: 'ADMIN' },
    })
    expect(await screen.findByText('APP_DASHBOARD_MARKER')).toBeInTheDocument()
  })

  it('links to forgot-password and register', () => {
    renderLoginPage()
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/register')
  })
})
