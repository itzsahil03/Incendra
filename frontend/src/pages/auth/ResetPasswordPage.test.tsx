import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as authApi from '@/api/auth'
import { ResetPasswordPage } from './ResetPasswordPage'

vi.mock('@/api/auth')

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

function renderPage(route: string) {
  return render(<ResetPasswordPage />, { wrapper: ({ children }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter> })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResetPasswordPage — missing token', () => {
  it('shows a missing-token message and a link to request a new one', () => {
    renderPage('/reset-password')
    expect(screen.getByText(/This link is missing its reset token/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })
})

describe('ResetPasswordPage — with a token', () => {
  it('shows a validation error when the passwords do not match', async () => {
    const user = userEvent.setup()
    renderPage('/reset-password?token=tok-1')
    await user.type(screen.getByLabelText('New password'), 'password1')
    await user.type(screen.getByLabelText('Confirm new password'), 'password2')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(authApi.resetPassword).not.toHaveBeenCalled()
  })

  it('shows a validation error for a too-short password', async () => {
    const user = userEvent.setup()
    renderPage('/reset-password?token=tok-1')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))
    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument()
  })

  it('resets the password and navigates to /login on success', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue(undefined as never)
    const user = userEvent.setup()
    renderPage('/reset-password?token=tok-1')
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => expect(authApi.resetPassword).toHaveBeenCalledWith({ token: 'tok-1', newPassword: 'newpassword1' }))
    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('shows a server error when the reset fails', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Token expired' } },
    })
    const user = userEvent.setup()
    renderPage('/reset-password?token=tok-1')
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Token expired')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
