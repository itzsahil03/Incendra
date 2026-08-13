import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput } from './TagInput'

describe('TagInput', () => {
  it('renders existing tags as removable badges', () => {
    render(<TagInput value={['alpha', 'beta']} onChange={vi.fn()} />)
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('beta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove alpha' })).toBeInTheDocument()
  })

  it('shows the placeholder only when there are no tags', () => {
    const { rerender } = render(<TagInput value={[]} onChange={vi.fn()} placeholder="Add a tag…" />)
    expect(screen.getByPlaceholderText('Add a tag…')).toBeInTheDocument()
    rerender(<TagInput value={['x']} onChange={vi.fn()} placeholder="Add a tag…" />)
    expect(screen.queryByPlaceholderText('Add a tag…')).not.toBeInTheDocument()
  })

  it('adds a new tag on Enter and clears the draft', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'newtag{Enter}')
    expect(onChange).toHaveBeenCalledWith(['newtag'])
  })

  it('does not add a duplicate tag', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagInput value={['dup']} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'dup{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not add an empty/whitespace-only tag', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagInput value={[]} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.type(input, '   {Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('commits the draft on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <>
        <TagInput value={[]} onChange={onChange} />
        <button>elsewhere</button>
      </>,
    )
    const input = screen.getByRole('textbox')
    await user.type(input, 'blurred')
    await user.click(screen.getByRole('button', { name: 'elsewhere' }))
    expect(onChange).toHaveBeenCalledWith(['blurred'])
  })

  it('removes the last tag on Backspace when the draft is empty', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagInput value={['first', 'second']} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.keyboard('{Backspace}')
    expect(onChange).toHaveBeenCalledWith(['first'])
  })

  it('does not remove a tag on Backspace when the draft has text', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagInput value={['first']} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'x')
    onChange.mockClear()
    await user.keyboard('{Backspace}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes a tag when its remove button is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagInput value={['alpha', 'beta']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Remove alpha' }))
    expect(onChange).toHaveBeenCalledWith(['beta'])
  })
})
