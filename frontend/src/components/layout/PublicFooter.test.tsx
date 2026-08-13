import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { PublicFooter } from './PublicFooter'

function renderFooter() {
  return render(<PublicFooter />, { wrapper: MemoryRouter })
}

describe('PublicFooter', () => {
  it('renders the brand and all column links', () => {
    renderFooter()
    expect(screen.getByText('Incendra')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/services')
    expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register')
  })

  it('shows the current year in the copyright line', () => {
    renderFooter()
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} Incendra`))).toBeInTheDocument()
  })
})
