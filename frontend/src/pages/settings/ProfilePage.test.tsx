import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import { useDeleteAccountMutation } from '@/queries/useAccounts'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { ProfilePage } from './ProfilePage'

vi.mock('@/queries/useAccounts')

beforeAll(stubRadixEnvironment)

const mockDelete = vi.mocked(useDeleteAccountMutation)

function renderPage() {
  const session: SessionState = { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'alice@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' } }
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session },
  })
  return render(
    <Provider store={store}>
      <ProfilePage />
    </Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDelete.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
})

describe('ProfilePage', () => {
  it('shows the user’s name, email, and role', () => {
    renderPage()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })

  it('opens the delete-account dialog', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Delete my account/ }))
    expect(await screen.findByText('Delete your account')).toBeInTheDocument()
  })

  it('disables the confirm button until a password is entered', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Delete my account/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('button[disabled]')).toBeTruthy()
  })

  it('submits the password to confirm deletion', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockDelete.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Delete my account/ }))
    await user.type(screen.getByPlaceholderText('Enter your password to confirm'), 'mypassword')
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    expect(mutateAsync).toHaveBeenCalledWith('mypassword')
  })

  it('shows a server error message on failure', async () => {
    mockDelete.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Cannot delete: sole admin' } } }),
      isPending: false,
    } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Delete my account/ }))
    await user.type(screen.getByPlaceholderText('Enter your password to confirm'), 'mypassword')
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    expect(await screen.findByText('Cannot delete: sole admin')).toBeInTheDocument()
  })
})
