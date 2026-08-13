import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ContactPage } from './ContactPage'

function renderPage() {
  return render(<ContactPage />, { wrapper: MemoryRouter })
}

describe('ContactPage', () => {
  it('renders the intro and contact channels', () => {
    renderPage()
    expect(screen.getByText('Get in touch')).toBeInTheDocument()
    expect(screen.getByText('General enquiries')).toBeInTheDocument()
    expect(screen.getByText('Product feedback')).toBeInTheDocument()
  })

  it('shows validation errors for empty/invalid fields', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.getByText('Tell us a bit more (10+ characters)')).toBeInTheDocument()
  })

  it('submits successfully and shows a confirmation, clearing the form', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Alice')
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.type(screen.getByLabelText('Message'), 'This is a long enough message.')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => expect(screen.getByText(/Thanks — your message has been received/)).toBeInTheDocument())
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })
})
