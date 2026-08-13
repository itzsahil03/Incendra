import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProviderBadge } from '../integrations/ProviderBadge'

describe('ProviderBadge', () => {
  it('renders the display name for a known provider', () => {
    render(<ProviderBadge provider="SLACK" />)
    expect(screen.getByText('Slack')).toBeInTheDocument()
  })

  it('falls back to Generic for an unknown provider', () => {
    render(<ProviderBadge provider="not-a-real-provider" />)
    expect(screen.getByText('Generic')).toBeInTheDocument()
  })

  it('applies a custom className', () => {
    const { container } = render(<ProviderBadge provider="JIRA" className="my-class" />)
    expect(container.querySelector('span')).toHaveClass('my-class')
  })
})
