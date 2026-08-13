import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Separator } from './separator'

describe('Separator', () => {
  it('renders horizontal by default as decorative (no separator role)', () => {
    render(<Separator data-testid="sep" />)
    const sep = screen.getByTestId('sep')
    expect(sep).toHaveAttribute('data-slot', 'separator')
    expect(sep).toHaveAttribute('data-orientation', 'horizontal')
    // decorative separators are hidden from the accessibility tree
    expect(sep).toHaveAttribute('role', 'none')
  })

  it('renders vertical orientation', () => {
    render(<Separator data-testid="sep" orientation="vertical" />)
    expect(screen.getByTestId('sep')).toHaveAttribute('data-orientation', 'vertical')
  })

  it('exposes separator role when decorative is false', () => {
    render(<Separator data-testid="sep" decorative={false} />)
    expect(screen.getByRole('separator')).toBe(screen.getByTestId('sep'))
  })

  it('merges custom className', () => {
    render(<Separator data-testid="sep" className="custom-sep" />)
    expect(screen.getByTestId('sep')).toHaveClass('custom-sep')
  })
})
