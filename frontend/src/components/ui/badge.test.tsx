import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, badgeVariants } from './badge'

describe('Badge', () => {
  it('renders as a span by default with default variant', () => {
    render(<Badge>New</Badge>)
    const badge = screen.getByText('New')
    expect(badge.tagName).toBe('SPAN')
    expect(badge).toHaveAttribute('data-slot', 'badge')
    expect(badge).toHaveAttribute('data-variant', 'default')
  })

  it.each(['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const)(
    'applies the %s variant classes',
    (variant) => {
      render(<Badge variant={variant}>Label</Badge>)
      const badge = screen.getByText('Label')
      expect(badge).toHaveAttribute('data-variant', variant)
    }
  )

  it('renders as a child element when asChild is set', () => {
    render(
      <Badge asChild>
        <a href="/incidents">Link Badge</a>
      </Badge>
    )
    const badge = screen.getByText('Link Badge')
    expect(badge.tagName).toBe('A')
    expect(badge).toHaveAttribute('href', '/incidents')
    expect(badge).toHaveAttribute('data-slot', 'badge')
  })

  it('merges custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>)
    expect(screen.getByText('Custom')).toHaveClass('custom-badge')
  })

  it('badgeVariants returns class string including variant classes', () => {
    const classes = badgeVariants({ variant: 'destructive' })
    expect(classes).toContain('bg-destructive')
  })
})
