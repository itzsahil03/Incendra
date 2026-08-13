import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriorityBadge } from './PriorityBadge'

describe('PriorityBadge', () => {
  it('renders the priority text', () => {
    render(<PriorityBadge priority="P1" />)
    expect(screen.getByText('P1')).toBeInTheDocument()
  })

  it('uses medium size padding/font by default', () => {
    render(<PriorityBadge priority="P2" />)
    const el = screen.getByText('P2')
    expect(el.style.fontSize).toBe('12px')
  })

  it('uses small size padding/font when requested', () => {
    render(<PriorityBadge priority="P3" size="small" />)
    const el = screen.getByText('P3')
    expect(el.style.fontSize).toBe('10px')
  })

  it('falls back to the P4 color for an unrecognized priority', () => {
    render(<PriorityBadge priority="P9" />)
    const el = screen.getByText('P9')
    expect(el.style.color).toBe('rgba(255, 255, 255, 0.6)')
  })
})
