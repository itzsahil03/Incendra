import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle, toggleVariants } from './toggle'

describe('Toggle', () => {
  it('renders unpressed by default and toggles pressed state on click', async () => {
    const user = userEvent.setup()
    render(<Toggle aria-label="bold">B</Toggle>)
    const toggle = screen.getByRole('button', { name: 'bold' })
    expect(toggle).toHaveAttribute('data-slot', 'toggle')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveAttribute('data-state', 'on')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('data-state', 'off')
  })

  it('supports controlled pressed prop and onPressedChange callback', async () => {
    const user = userEvent.setup()
    const onPressedChange = vi.fn()
    render(
      <Toggle pressed={false} onPressedChange={onPressedChange} aria-label="italic">
        I
      </Toggle>
    )
    await user.click(screen.getByRole('button'))
    expect(onPressedChange).toHaveBeenCalledWith(true)
  })

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup()
    const onPressedChange = vi.fn()
    render(
      <Toggle disabled onPressedChange={onPressedChange} aria-label="disabled-toggle">
        D
      </Toggle>
    )
    const toggle = screen.getByRole('button')
    expect(toggle).toBeDisabled()
    await user.click(toggle)
    expect(onPressedChange).not.toHaveBeenCalled()
  })

  it('applies outline variant and size classes', () => {
    render(
      <Toggle variant="outline" size="lg" aria-label="outline-toggle">
        O
      </Toggle>
    )
    const toggle = screen.getByRole('button')
    expect(toggle).toHaveClass('border')
    expect(toggle).toHaveClass('h-10')
  })

  it('toggleVariants returns class string', () => {
    const classes = toggleVariants({ variant: 'outline', size: 'sm' })
    expect(classes).toContain('border')
    expect(classes).toContain('h-8')
  })
})
