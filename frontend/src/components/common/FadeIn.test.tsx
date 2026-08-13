import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FadeIn } from './FadeIn'

beforeAll(() => {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as unknown as typeof IntersectionObserver
})

describe('FadeIn', () => {
  it('renders its children', () => {
    render(
      <FadeIn>
        <p>Inner content</p>
      </FadeIn>,
    )
    expect(screen.getByText('Inner content')).toBeInTheDocument()
  })

  it('accepts a delay prop without throwing', () => {
    render(
      <FadeIn delay={0.3}>
        <span>Delayed</span>
      </FadeIn>,
    )
    expect(screen.getByText('Delayed')).toBeInTheDocument()
  })
})
