import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ProviderAvatar, providerBadge } from './ProviderAvatar'

describe('providerBadge', () => {
  it('returns a known badge for a recognized source, case-insensitively', () => {
    expect(providerBadge('datadog').color).toBe('#632CA6')
    expect(providerBadge('DataDog').color).toBe('#632CA6')
  })

  it('falls back to the default badge for an unrecognized source', () => {
    expect(providerBadge('some-unknown-tool').color).toBe('#64748b')
  })
})

describe('ProviderAvatar', () => {
  it('renders a circular avatar sized to the size prop', () => {
    const { container } = render(<ProviderAvatar source="prometheus" size={40} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.width).toBe('40px')
    expect(wrapper.style.height).toBe('40px')
    expect(wrapper.style.backgroundColor).toBe('rgb(230, 82, 44)')
  })

  it('uses the default size of 32 when not provided', () => {
    const { container } = render(<ProviderAvatar source="grafana" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.width).toBe('32px')
  })

  it('renders an icon svg', () => {
    const { container } = render(<ProviderAvatar source="unknown-source" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
