import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Zap, MessagesSquare } from 'lucide-react'
import { AuthLayout } from './AuthLayout'

beforeAll(() => {
  // jsdom's HTMLMediaElement.play() resolves to `undefined` instead of a Promise,
  // which crashes HeroBackground's `video.play().catch(...)` — stub it so any page
  // that renders AuthLayout (and therefore HeroBackground) doesn't blow up on mount.
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
})

describe('AuthLayout', () => {
  it('renders the title, subtitle, and children', () => {
    render(
      <AuthLayout title="Welcome back" subtitle="Sign in to continue">
        <p>form goes here</p>
      </AuthLayout>,
      { wrapper: MemoryRouter },
    )

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByText('Sign in to continue')).toBeInTheDocument()
    expect(screen.getByText('form goes here')).toBeInTheDocument()
  })

  it('omits the subtitle paragraph when none is passed', () => {
    render(
      <AuthLayout title="No subtitle here">
        <p>content</p>
      </AuthLayout>,
      { wrapper: MemoryRouter },
    )

    expect(screen.getByRole('heading', { name: 'No subtitle here' })).toBeInTheDocument()
    // Only the title should render in the header block — no stray subtitle text.
    expect(screen.queryByText(/sign in to continue/i)).not.toBeInTheDocument()
  })

  it('falls back to the default hero eyebrow/headline/subtext when none are provided', () => {
    render(
      <AuthLayout title="Title">
        <p>content</p>
      </AuthLayout>,
      { wrapper: MemoryRouter },
    )

    expect(screen.getByText('Incident response, coordinated')).toBeInTheDocument()
    expect(screen.getByText('Respond faster.')).toBeInTheDocument()
    expect(screen.getByText('Resolve smarter.')).toBeInTheDocument()
    expect(
      screen.getByText('Alerts in, ownership assigned, response coordinated live, resolution out.'),
    ).toBeInTheDocument()
  })

  it('renders custom hero eyebrow/headline/subtext when provided', () => {
    render(
      <AuthLayout
        title="Title"
        heroEyebrow="You're invited"
        heroHeadline={['Join the', 'team.']}
        heroSubtext="Custom subtext"
      >
        <p>content</p>
      </AuthLayout>,
      { wrapper: MemoryRouter },
    )

    expect(screen.getByText("You're invited")).toBeInTheDocument()
    expect(screen.getByText('Join the')).toBeInTheDocument()
    expect(screen.getByText('team.')).toBeInTheDocument()
    expect(screen.getByText('Custom subtext')).toBeInTheDocument()
    expect(screen.queryByText('Incident response, coordinated')).not.toBeInTheDocument()
  })

  it('renders heroBullets instead of heroSubtext when bullets are provided', () => {
    render(
      <AuthLayout
        title="Title"
        heroSubtext="Should not appear"
        heroBullets={[
          { icon: Zap, text: 'Ingest signed alerts from your monitoring stack.' },
          { icon: MessagesSquare, text: 'Coordinate response in per-incident chat.' },
        ]}
      >
        <p>content</p>
      </AuthLayout>,
      { wrapper: MemoryRouter },
    )

    expect(screen.getByText('Ingest signed alerts from your monitoring stack.')).toBeInTheDocument()
    expect(screen.getByText('Coordinate response in per-incident chat.')).toBeInTheDocument()
    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument()
  })
})
