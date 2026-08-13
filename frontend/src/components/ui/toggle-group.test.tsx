import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

describe('ToggleGroup', () => {
  it('renders items and allows single selection', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <ToggleGroup type="single" onValueChange={onValueChange}>
        <ToggleGroupItem value="bold" aria-label="Bold">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic">
          I
        </ToggleGroupItem>
      </ToggleGroup>
    )

    await user.click(screen.getByRole('radio', { name: 'Bold' }))
    expect(onValueChange).toHaveBeenCalledWith('bold')
  })

  it('supports multiple selection type', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <ToggleGroup type="multiple" onValueChange={onValueChange}>
        <ToggleGroupItem value="bold" aria-label="Bold">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic">
          I
        </ToggleGroupItem>
      </ToggleGroup>
    )

    await user.click(screen.getByRole('button', { name: 'Bold' }))
    await user.click(screen.getByRole('button', { name: 'Italic' }))
    expect(onValueChange).toHaveBeenLastCalledWith(['bold', 'italic'])
  })

  it('passes variant/size context down to items and lets item override when no group value set', () => {
    render(
      <ToggleGroup type="single" variant="outline" size="lg">
        <ToggleGroupItem value="a" aria-label="A" data-testid="item-a">
          A
        </ToggleGroupItem>
      </ToggleGroup>
    )
    const item = screen.getByTestId('item-a')
    expect(item).toHaveAttribute('data-variant', 'outline')
    expect(item).toHaveAttribute('data-size', 'lg')
  })

  it('applies custom spacing data attribute on the group and items', () => {
    render(
      <ToggleGroup type="single" spacing={2}>
        <ToggleGroupItem value="a" aria-label="A" data-testid="item-a">
          A
        </ToggleGroupItem>
      </ToggleGroup>
    )
    const item = screen.getByTestId('item-a')
    expect(item).toHaveAttribute('data-spacing', '2')
  })

  it('disables an individual item', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <ToggleGroup type="single" onValueChange={onValueChange}>
        <ToggleGroupItem value="a" aria-label="A" disabled>
          A
        </ToggleGroupItem>
      </ToggleGroup>
    )
    const item = screen.getByRole('radio', { name: 'A' })
    expect(item).toBeDisabled()
    await user.click(item)
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
