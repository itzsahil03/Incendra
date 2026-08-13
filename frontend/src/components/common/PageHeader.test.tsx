import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Incidents" />)
    expect(screen.getByRole('heading', { name: 'Incidents' })).toBeInTheDocument()
  })

  it('renders an eyebrow and subtitle when provided', () => {
    render(<PageHeader title="Incidents" eyebrow="Workspace" subtitle="All active incidents" />)
    expect(screen.getByText('Workspace')).toBeInTheDocument()
    expect(screen.getByText('All active incidents')).toBeInTheDocument()
  })

  it('omits the eyebrow and subtitle when not provided', () => {
    render(<PageHeader title="Incidents" />)
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
  })

  it('renders icon and actions content', () => {
    render(<PageHeader title="Incidents" icon={<span data-testid="icon">*</span>} actions={<button>New</button>} />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
  })
})
