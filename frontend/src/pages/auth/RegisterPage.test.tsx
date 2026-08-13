import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RegisterPage } from './RegisterPage'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

function renderPage() {
  return render(<RegisterPage />, { wrapper: MemoryRouter })
}

describe('RegisterPage', () => {
  it('renders the form and a link back to login', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /Already have an account/ })).toHaveAttribute('href', '/login')
  })

  it('shows validation errors for empty/invalid fields', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
  })

  it('navigates to /welcome with the form values as router state on success, without calling any API', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Alice')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.type(screen.getByLabelText('Password'), 'supersecret')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(navigateMock).toHaveBeenCalledWith('/welcome', {
      replace: true,
      state: { name: 'Alice', email: 'alice@example.com', password: 'supersecret' },
    })
  })
})
