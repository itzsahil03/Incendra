import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LoadingState } from './LoadingState'

describe('LoadingState', () => {
  it('renders a spinner with the default min-height', () => {
    const { container } = render(<LoadingState />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.minHeight).toBe('240px')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('respects a custom minHeight', () => {
    const { container } = render(<LoadingState minHeight={80} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.minHeight).toBe('80px')
  })
})
