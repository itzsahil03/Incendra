import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as authApi from '@/api/auth'
import { ForgotPasswordPage } from './ForgotPasswordPage'

vi.mock('@/api/auth')

function renderPage() {
  return render(<ForgotPasswordPage />, { wrapper: MemoryRouter })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ForgotPasswordPage', () => {
  it('shows a validation error for an invalid email', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(authApi.forgotPassword).not.toHaveBeenCalled()
  })

  it('sends the reset link and shows the check-your-email confirmation', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue(undefined as never)
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => expect(authApi.forgotPassword).toHaveBeenCalledWith('alice@example.com'))
    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText(/If an account exists for that email/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
  })

  it('shows a server error message when the request fails', async () => {
    vi.mocked(authApi.forgotPassword).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Too many requests' } },
    })
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Too many requests')).toBeInTheDocument()
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
  })
})
