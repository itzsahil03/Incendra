import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as authApi from '@/api/auth'
import { ChangePasswordPage } from './ChangePasswordPage'

vi.mock('@/api/auth')
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

function renderPage() {
  return render(<ChangePasswordPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ChangePasswordPage', () => {
  it('shows validation errors for empty/invalid fields', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('Required')).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
  })

  it('shows a mismatch error when confirm password differs', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Current password'), 'oldpassword')
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword2')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
  })

  it('submits successfully and resets the form', async () => {
    vi.mocked(authApi.changePassword).mockResolvedValue(undefined as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Current password'), 'oldpassword')
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    await vi.waitFor(() => expect(authApi.changePassword).toHaveBeenCalledWith({
      currentPassword: 'oldpassword',
      newPassword: 'newpassword1',
      confirmPassword: 'newpassword1',
    }))
    expect(toast.success).toHaveBeenCalledWith('Password changed')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
  })

  it('shows a server error on failure', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Current password is incorrect' } },
    })
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Current password'), 'wrong')
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
  })
})
