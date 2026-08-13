import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AboutPage } from './AboutPage'

describe('AboutPage', () => {
  it('renders the intro and all four values', () => {
    render(<AboutPage />, { wrapper: MemoryRouter })
    expect(screen.getByText('About us')).toBeInTheDocument()
    expect(screen.getByText('Speed over ceremony')).toBeInTheDocument()
    expect(screen.getByText('Nothing hidden')).toBeInTheDocument()
    expect(screen.getByText('Access that’s actually enforced')).toBeInTheDocument()
    expect(screen.getByText('Built for the whole team')).toBeInTheDocument()
  })
})
