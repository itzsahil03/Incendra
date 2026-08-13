import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, buttonVariants } from './button'

describe('Button', () => {
  it('renders a button element with default variant/size data attributes', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toHaveAttribute('data-slot', 'button')
    expect(button).toHaveAttribute('data-variant', 'default')
    expect(button).toHaveAttribute('data-size', 'default')
  })

  it.each(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const)(
    'applies the %s variant',
    (variant) => {
      render(<Button variant={variant}>Btn</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('data-variant', variant)
    }
  )

  it.each(['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const)(
    'applies the %s size',
    (size) => {
      render(<Button size={size}>Btn</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('data-size', size)
    }
  )

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick and shows disabled state when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    )
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as a child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/somewhere">Link</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Link' })
    expect(link).toHaveAttribute('href', '/somewhere')
    expect(link).toHaveAttribute('data-slot', 'button')
  })

  it('merges custom className', () => {
    render(<Button className="custom-btn">Btn</Button>)
    expect(screen.getByRole('button')).toHaveClass('custom-btn')
  })

  it('buttonVariants returns class string including variant/size classes', () => {
    const classes = buttonVariants({ variant: 'destructive', size: 'lg' })
    expect(classes).toContain('bg-destructive')
    expect(classes).toContain('h-10')
  })
})
