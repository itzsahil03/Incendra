import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './input'

describe('Input', () => {
  it('renders with data-slot and default type text behavior', async () => {
    const user = userEvent.setup()
    render(<Input placeholder="Search" />)
    const input = screen.getByPlaceholderText('Search')
    expect(input).toHaveAttribute('data-slot', 'input')
    await user.type(input, 'hello')
    expect(input).toHaveValue('hello')
  })

  it('applies the given type attribute', () => {
    render(<Input type="email" placeholder="Email" />)
    expect(screen.getByPlaceholderText('Email')).toHaveAttribute('type', 'email')
  })

  it('is disabled when disabled prop is passed', () => {
    render(<Input disabled placeholder="Disabled" />)
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
  })

  it('calls onChange handler', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Input placeholder="Change" onChange={onChange} />)
    await user.type(screen.getByPlaceholderText('Change'), 'x')
    expect(onChange).toHaveBeenCalled()
  })

  it('merges custom className', () => {
    render(<Input placeholder="Custom" className="custom-input" />)
    expect(screen.getByPlaceholderText('Custom')).toHaveClass('custom-input')
  })

  it('reflects aria-invalid attribute', () => {
    render(<Input placeholder="Invalid" aria-invalid="true" />)
    expect(screen.getByPlaceholderText('Invalid')).toHaveAttribute('aria-invalid', 'true')
  })
})
