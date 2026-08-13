import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('renders a div with animate-pulse and data-slot', () => {
    render(<Skeleton data-testid="skeleton" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveAttribute('data-slot', 'skeleton')
    expect(skeleton).toHaveClass('animate-pulse')
  })

  it('merges custom className', () => {
    render(<Skeleton data-testid="skeleton" className="h-4 w-4" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveClass('h-4')
    expect(skeleton).toHaveClass('animate-pulse')
  })
})
