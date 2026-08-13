import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No incidents" />)
    expect(screen.getByText('No incidents')).toBeInTheDocument()
  })

  it('renders the description when provided', () => {
    render(<EmptyState title="No incidents" description="Create your first incident to get started." />)
    expect(screen.getByText('Create your first incident to get started.')).toBeInTheDocument()
  })

  it('omits the description when not provided', () => {
    const { container } = render(<EmptyState title="No incidents" />)
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })

  it('renders action content', () => {
    render(<EmptyState title="No incidents" action={<button>Create incident</button>} />)
    expect(screen.getByRole('button', { name: 'Create incident' })).toBeInTheDocument()
  })

  it('uses compact layout classes when compact is true', () => {
    const { container } = render(<EmptyState title="No incidents" description="desc" compact />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toHaveClass('items-start')
    expect(wrapper).not.toHaveClass('items-center')
  })

  it('uses the default centered layout classes when compact is false', () => {
    const { container } = render(<EmptyState title="No incidents" description="desc" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toHaveClass('items-center')
  })
})
