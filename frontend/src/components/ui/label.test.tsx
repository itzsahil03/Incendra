import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Label } from './label'

describe('Label', () => {
  it('renders label text with data-slot attribute', () => {
    render(<Label htmlFor="name">Name</Label>)
    const label = screen.getByText('Name')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('data-slot', 'label')
    expect(label).toHaveAttribute('for', 'name')
  })

  it('associates with an input via htmlFor and focuses it on click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </div>
    )
    await user.click(screen.getByText('Email'))
    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('merges custom className', () => {
    render(<Label className="custom-label">Custom</Label>)
    expect(screen.getByText('Custom')).toHaveClass('custom-label')
  })
})
