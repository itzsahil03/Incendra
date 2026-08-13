import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Combobox, type ComboboxOption } from './Combobox'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false) as unknown as typeof Element.prototype.hasPointerCapture
})

const options: ComboboxOption[] = [
  { id: '1', label: 'Alice' },
  { id: '2', label: 'Bob' },
]

describe('Combobox', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(<Combobox options={options} value={null} onChange={vi.fn()} placeholder="Pick someone" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Pick someone')
  })

  it('shows the label of the currently selected option', () => {
    render(<Combobox options={options} value="2" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Bob')
  })

  it('renders a custom value via renderValue when selected', () => {
    render(
      <Combobox
        options={options}
        value="1"
        onChange={vi.fn()}
        renderValue={(o) => <span data-testid="custom-value">Chosen: {o.label}</span>}
      />,
    )
    expect(screen.getByTestId('custom-value')).toHaveTextContent('Chosen: Alice')
  })

  it('opens the popover and lists all options on click', async () => {
    const user = userEvent.setup()
    render(<Combobox options={options} value={null} onChange={vi.fn()} />)
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('calls onChange with the selected option id and closes the popover', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Combobox options={options} value={null} onChange={onChange} />)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Bob'))
    expect(onChange).toHaveBeenCalledWith('2')
  })

  it('filters options via the search input', async () => {
    const user = userEvent.setup()
    render(<Combobox options={options} value={null} onChange={vi.fn()} searchPlaceholder="Search…" />)
    await user.click(screen.getByRole('combobox'))
    const search = await screen.findByPlaceholderText('Search…')
    await user.type(search, 'Ali')
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('shows the empty text when no options match the search', async () => {
    const user = userEvent.setup()
    render(<Combobox options={options} value={null} onChange={vi.fn()} emptyText="Nobody found" />)
    await user.click(screen.getByRole('combobox'))
    const search = await screen.findByPlaceholderText('Search…')
    await user.type(search, 'zzz')
    expect(await screen.findByText('Nobody found')).toBeInTheDocument()
  })

  it('is disabled when the disabled prop is set', () => {
    render(<Combobox options={options} value={null} onChange={vi.fn()} disabled />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('renders a custom option via renderOption', async () => {
    const user = userEvent.setup()
    render(<Combobox options={options} value={null} onChange={vi.fn()} renderOption={(o) => <span data-testid={`opt-${o.id}`}>{o.label} 🎯</span>} />)
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByTestId('opt-1')).toHaveTextContent('Alice 🎯')
  })
})
