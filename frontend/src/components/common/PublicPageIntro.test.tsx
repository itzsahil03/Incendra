import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicPageIntro } from './PublicPageIntro'

beforeAll(() => {
  // PublicPageIntro renders HeroBackground, which plays a background video —
  // jsdom's HTMLMediaElement has no real playback implementation.
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
})

describe('PublicPageIntro', () => {
  it('renders the eyebrow and title', () => {
    render(<PublicPageIntro eyebrow="About" title="Who we are" />)
    expect(screen.getByText('About')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Who we are' })).toBeInTheDocument()
  })

  it('renders a subtitle when provided', () => {
    render(<PublicPageIntro eyebrow="About" title="Who we are" subtitle="Our story" />)
    expect(screen.getByText('Our story')).toBeInTheDocument()
  })

  it('omits the subtitle paragraph when not provided', () => {
    render(<PublicPageIntro eyebrow="About" title="Who we are" />)
    expect(screen.queryByText('Our story')).not.toBeInTheDocument()
  })

  it('accepts a ReactNode title', () => {
    render(<PublicPageIntro eyebrow="About" title={<span data-testid="rich-title">Rich title</span>} />)
    expect(screen.getByTestId('rich-title')).toBeInTheDocument()
  })
})
