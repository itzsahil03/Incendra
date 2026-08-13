import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Flame } from 'lucide-react'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders the label and value', () => {
    render(<StatCard label="Open incidents" value={7} icon={Flame} bg="#333" fg="#fff" trend={null} />)
    expect(screen.getByText('Open incidents')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders the TrendBadge with trend data', () => {
    render(<StatCard label="Alerts" value={3} icon={Flame} bg="#333" fg="#fff" trend={{ pct: 20, isNew: false }} />)
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('renders the no-trend fallback when trend is null', () => {
    render(<StatCard label="Alerts" value={3} icon={Flame} bg="#333" fg="#fff" trend={null} />)
    expect(screen.getByText('No change data yet')).toBeInTheDocument()
  })
})
