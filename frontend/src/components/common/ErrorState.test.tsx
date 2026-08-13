import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorState } from './ErrorState'

describe('ErrorState', () => {
  it('renders the default title with a derived message', () => {
    render(<ErrorState error={new Error('Network down')} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Network down')).toBeInTheDocument()
  })

  it('renders a custom title', () => {
    render(<ErrorState error={new Error('boom')} title="Failed to load incidents" />)
    expect(screen.getByText('Failed to load incidents')).toBeInTheDocument()
  })

  it('falls back to a generic message for a non-Error value', () => {
    render(<ErrorState error={'just a string'} />)
    expect(screen.getAllByText('Something went wrong')).toHaveLength(2)
  })
})
