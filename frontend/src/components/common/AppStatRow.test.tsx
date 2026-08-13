import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppStatRow } from './AppStatRow'

describe('AppStatRow', () => {
  it('renders each stat label and value', () => {
    render(
      <AppStatRow
        stats={[
          { label: 'Open', value: 12 },
          { label: 'Closed', value: 40 },
        ]}
      />,
    )
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
  })

  it('applies a custom color to a stat value when provided', () => {
    render(<AppStatRow stats={[{ label: 'Critical', value: 3, color: '#e5766c' }]} />)
    const value = screen.getByText('3')
    expect(value.style.color).toBe('rgb(229, 118, 108)')
  })

  it('does not add a left border to the first stat but does for subsequent ones', () => {
    const { container } = render(
      <AppStatRow
        stats={[
          { label: 'A', value: 1 },
          { label: 'B', value: 2 },
        ]}
      />,
    )
    const wrappers = container.querySelectorAll(':scope > div > div')
    expect(wrappers[0]).toHaveClass('pl-0')
    expect(wrappers[1]).toHaveClass('border-l')
  })
})
