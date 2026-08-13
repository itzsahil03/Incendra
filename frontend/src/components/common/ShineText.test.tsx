import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShineText } from './ShineText'

describe('ShineText', () => {
  it('renders children text', () => {
    render(<ShineText>Blazing fast</ShineText>)
    expect(screen.getByText('Blazing fast')).toBeInTheDocument()
  })

  it('applies the shine-text class alongside a custom className', () => {
    render(<ShineText className="extra-class">Hello</ShineText>)
    const el = screen.getByText('Hello')
    expect(el).toHaveClass('shine-text')
    expect(el).toHaveClass('extra-class')
    expect(el.tagName).toBe('SPAN')
  })
})
