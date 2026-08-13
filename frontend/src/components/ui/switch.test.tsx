import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from './switch'

describe('Switch', () => {
  it('renders unchecked by default and toggles on click', async () => {
    const user = userEvent.setup()
    render(<Switch aria-label="toggle-me" />)
    const sw = screen.getByRole('switch', { name: 'toggle-me' })
    expect(sw).toHaveAttribute('data-slot', 'switch')
    expect(sw).toHaveAttribute('aria-checked', 'false')

    await user.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('supports controlled checked prop with onCheckedChange', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch checked={false} onCheckedChange={onCheckedChange} aria-label="controlled" />)
    await user.click(screen.getByRole('switch'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch disabled onCheckedChange={onCheckedChange} aria-label="disabled-switch" />)
    const sw = screen.getByRole('switch')
    expect(sw).toBeDisabled()
    await user.click(sw)
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('applies the sm size data attribute', () => {
    render(<Switch size="sm" aria-label="small-switch" />)
    expect(screen.getByRole('switch')).toHaveAttribute('data-size', 'sm')
  })

  it('defaults to the default size', () => {
    render(<Switch aria-label="default-switch" />)
    expect(screen.getByRole('switch')).toHaveAttribute('data-size', 'default')
  })
})
