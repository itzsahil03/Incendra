import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the label text', () => {
    render(<StatusBadge label="Delivered" color="#4fbf8f" />)
    expect(screen.getByText('Delivered')).toBeInTheDocument()
  })

  it('applies the given color to the label span', () => {
    render(<StatusBadge label="Failed" color="#e5766c" />)
    const label = screen.getByText('Failed')
    expect(label.style.color).toBe('rgb(229, 118, 108)')
  })
})
