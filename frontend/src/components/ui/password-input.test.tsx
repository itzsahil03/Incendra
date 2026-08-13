import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChangeEvent } from 'react'
import { PasswordInput } from './password-input'

describe('PasswordInput', () => {
  it('starts masked and toggles to visible text and back on click', async () => {
    const user = userEvent.setup()
    render(<PasswordInput placeholder="Password" />)

    const input = screen.getByPlaceholderText('Password')
    expect(input).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('forwards other input props like value and onChange', async () => {
    const user = userEvent.setup()
    let value = ''
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      value = e.target.value
    }
    render(<PasswordInput placeholder="Password" onChange={handleChange} />)

    await user.type(screen.getByPlaceholderText('Password'), 'secret')

    expect(value).toBe('secret')
  })
})
