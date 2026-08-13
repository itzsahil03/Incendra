import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from './textarea'

describe('Textarea', () => {
  it('renders with data-slot and accepts typed text', async () => {
    const user = userEvent.setup()
    render(<Textarea placeholder="Describe the incident" />)
    const textarea = screen.getByPlaceholderText('Describe the incident')
    expect(textarea).toHaveAttribute('data-slot', 'textarea')
    await user.type(textarea, 'It is on fire')
    expect(textarea).toHaveValue('It is on fire')
  })

  it('is disabled when disabled prop is passed', () => {
    render(<Textarea disabled placeholder="Disabled" />)
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
  })

  it('calls onChange handler', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Textarea placeholder="Change" onChange={onChange} />)
    await user.type(screen.getByPlaceholderText('Change'), 'a')
    expect(onChange).toHaveBeenCalled()
  })

  it('merges custom className', () => {
    render(<Textarea placeholder="Custom" className="custom-textarea" />)
    expect(screen.getByPlaceholderText('Custom')).toHaveClass('custom-textarea')
  })
})
