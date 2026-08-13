import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserAvatar } from './UserAvatar'

describe('UserAvatar', () => {
  it('renders the uppercased first letter of the name as the fallback', () => {
    render(<UserAvatar name="priya" />)
    expect(screen.getByText('P')).toBeInTheDocument()
  })

  it('renders a gear icon instead of an initial when name is exactly "System"', () => {
    const { container } = render(<UserAvatar name="System" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.queryByText('S')).not.toBeInTheDocument()
  })

  it('produces a stable background color for the same name across renders', () => {
    const { container: first } = render(<UserAvatar name="Ravi Kumar" />)
    const { container: second } = render(<UserAvatar name="Ravi Kumar" />)

    const firstStyle = first.querySelector('[class*="items-center"]')?.getAttribute('style')
    const secondStyle = second.querySelector('[class*="items-center"]')?.getAttribute('style')
    expect(firstStyle).toBe(secondStyle)
  })
})
