import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrendBadge } from './TrendBadge'

describe('TrendBadge', () => {
  it('shows a "no change data" message when trend is null', () => {
    render(<TrendBadge trend={null} />)
    expect(screen.getByText('No change data yet')).toBeInTheDocument()
  })

  it('shows "New this week" when isNew is true', () => {
    render(<TrendBadge trend={{ pct: null, isNew: true }} />)
    expect(screen.getByText('New this week')).toBeInTheDocument()
  })

  it('renders an upward trend with default label', () => {
    render(<TrendBadge trend={{ pct: 12, isNew: false }} />)
    expect(screen.getByText('12%')).toBeInTheDocument()
    expect(screen.getByText('vs last 7 days')).toBeInTheDocument()
  })

  it('renders a downward trend using the absolute value', () => {
    render(<TrendBadge trend={{ pct: -8, isNew: false }} />)
    expect(screen.getByText('8%')).toBeInTheDocument()
  })

  it('uses a custom label when provided', () => {
    render(<TrendBadge trend={{ pct: 5, isNew: false, label: 'vs yesterday' }} />)
    expect(screen.getByText('vs yesterday')).toBeInTheDocument()
  })

  it('treats a missing pct as zero and non-negative (up)', () => {
    render(<TrendBadge trend={{ pct: null, isNew: false }} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
