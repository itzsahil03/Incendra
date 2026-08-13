import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea } from './input-group'

describe('InputGroup', () => {
  it('renders an input with a leading text addon and a trailing button', () => {
    render(
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="Amount" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton>Go</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>,
    )
    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Amount')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
  })

  it('focuses the input when the addon (not a button within it) is clicked', async () => {
    const user = userEvent.setup()
    render(
      <InputGroup>
        <InputGroupAddon data-testid="addon">
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="Amount" />
      </InputGroup>,
    )
    await user.click(screen.getByTestId('addon'))
    expect(screen.getByPlaceholderText('Amount')).toHaveFocus()
  })

  it('does not steal focus when a button inside the addon is clicked', async () => {
    const user = userEvent.setup()
    render(
      <InputGroup>
        <InputGroupInput placeholder="Amount" />
        <InputGroupAddon align="inline-end" data-testid="addon">
          <InputGroupButton>Go</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(screen.getByPlaceholderText('Amount')).not.toHaveFocus()
  })

  it('renders a textarea variant', () => {
    render(
      <InputGroup>
        <InputGroupTextarea placeholder="Notes" />
      </InputGroup>,
    )
    expect(screen.getByPlaceholderText('Notes').tagName).toBe('TEXTAREA')
  })
})
