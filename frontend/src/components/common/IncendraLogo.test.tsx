import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { IncendraLogo } from './IncendraLogo'

describe('IncendraLogo', () => {
  it('renders the Incendra wordmark by default (full variant)', () => {
    render(<IncendraLogo />, { wrapper: MemoryRouter })
    expect(screen.getByText('Incendra')).toBeInTheDocument()
  })

  it('renders only the mark, with no wordmark text, for variant="mark"', () => {
    render(<IncendraLogo variant="mark" />, { wrapper: MemoryRouter })
    expect(screen.queryByText('Incendra')).not.toBeInTheDocument()
  })

  it('wraps in a link to home by default', () => {
    render(<IncendraLogo />, { wrapper: MemoryRouter })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders without a link when withLink is false', () => {
    render(<IncendraLogo withLink={false} />, { wrapper: MemoryRouter })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Incendra')).toBeInTheDocument()
  })

  it('gives the mark-only variant an accessible name on its link since it has no visible text', () => {
    render(<IncendraLogo variant="mark" />, { wrapper: MemoryRouter })
    expect(screen.getByRole('link', { name: 'Incendra home' })).toBeInTheDocument()
  })

  it('applies a custom size to the mark', () => {
    const { container } = render(<IncendraLogo size={64} />, { wrapper: MemoryRouter })
    const mark = container.querySelector('span[style*="width"]') as HTMLElement
    expect(mark.style.width).toBe('64px')
    expect(mark.style.height).toBe('64px')
  })

  it('inlines the shield-and-flame mark SVG', () => {
    const { container } = render(<IncendraLogo />, { wrapper: MemoryRouter })
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('defaults to the light-background text color', () => {
    const { container } = render(<IncendraLogo withLink={false} />, { wrapper: MemoryRouter })
    expect(container.querySelector('.text-foreground')).toBeInTheDocument()
  })

  it('switches to white text for theme="dark"', () => {
    const { container } = render(<IncendraLogo withLink={false} theme="dark" />, { wrapper: MemoryRouter })
    expect(container.querySelector('.text-white')).toBeInTheDocument()
  })
})
