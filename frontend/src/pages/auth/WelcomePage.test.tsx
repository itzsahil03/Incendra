import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import sessionReducer from '@/features/session/sessionSlice'
import { WelcomePage } from './WelcomePage'
import type { PendingRegistration } from './WelcomePage'
import * as authApi from '@/api/auth'

vi.mock('@/api/auth')

const mockRegister = vi.mocked(authApi.register)

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
})

function renderWelcomePage(pending: PendingRegistration | null) {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session: { token: null, refreshToken: null, user: null } },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[{ pathname: '/welcome', state: pending }]}>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/register" element={<div>REGISTER_PAGE_MARKER</div>} />
          <Route path="/app" element={<div>APP_DASHBOARD_MARKER</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe('WelcomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bounces back to /register when there is no pending registration state', async () => {
    renderWelcomePage(null)
    expect(await screen.findByText('REGISTER_PAGE_MARKER')).toBeInTheDocument()
  })

  it('greets the user with their first name and keeps the create button disabled until a name is typed', async () => {
    const user = userEvent.setup()
    renderWelcomePage({ name: 'Jordan Rivers', email: 'jordan@example.com', password: 'password123' })

    expect(screen.getByRole('heading', { name: 'Welcome, Jordan' })).toBeInTheDocument()
    const createButton = screen.getByRole('button', { name: 'Create organization' })
    expect(createButton).toBeDisabled()

    await user.type(screen.getByLabelText('Organization name'), '   ')
    expect(createButton).toBeDisabled()

    await user.clear(screen.getByLabelText('Organization name'))
    await user.type(screen.getByLabelText('Organization name'), 'Acme Inc')
    expect(createButton).toBeEnabled()
  })

  it('creates the organization and navigates to the dashboard on success', async () => {
    const user = userEvent.setup()
    const pending: PendingRegistration = { name: 'Jordan Rivers', email: 'jordan@example.com', password: 'password123' }
    mockRegister.mockResolvedValue({
      token: 'tok',
      refreshToken: 'refresh',
      user: { id: 'u1', email: pending.email, name: pending.name, orgId: 'org-1', role: 'ADMIN' },
    })
    renderWelcomePage(pending)

    await user.type(screen.getByLabelText('Organization name'), 'Acme Inc')
    await user.click(screen.getByRole('button', { name: 'Create organization' }))

    expect(await screen.findByText('APP_DASHBOARD_MARKER')).toBeInTheDocument()
    expect(mockRegister).toHaveBeenCalledWith({ ...pending, orgName: 'Acme Inc' })
  })

  it('shows the submitting state while the request is in flight', async () => {
    const user = userEvent.setup()
    let resolveRegister: (v: unknown) => void = () => {}
    mockRegister.mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve
      }) as unknown as ReturnType<typeof authApi.register>,
    )
    renderWelcomePage({ name: 'Jordan Rivers', email: 'jordan@example.com', password: 'password123' })

    await user.type(screen.getByLabelText('Organization name'), 'Acme Inc')
    await user.click(screen.getByRole('button', { name: 'Create organization' }))

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled()

    resolveRegister({
      token: 'tok',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'jordan@example.com', name: 'Jordan Rivers', orgId: 'org-1', role: 'ADMIN' },
    })
    expect(await screen.findByText('APP_DASHBOARD_MARKER')).toBeInTheDocument()
  })

  it('shows a server error with a "Go back" link and stays on the page when creation fails', async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'That email is already registered' } },
    })
    renderWelcomePage({ name: 'Jordan Rivers', email: 'jordan@example.com', password: 'password123' })

    await user.type(screen.getByLabelText('Organization name'), 'Acme Inc')
    await user.click(screen.getByRole('button', { name: 'Create organization' }))

    expect(await screen.findByText('That email is already registered')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go back' })).toHaveAttribute('href', '/register')
    expect(screen.queryByText('APP_DASHBOARD_MARKER')).not.toBeInTheDocument()
  })
})
