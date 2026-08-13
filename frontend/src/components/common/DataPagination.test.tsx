import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataPagination } from './DataPagination'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false) as unknown as typeof Element.prototype.hasPointerCapture
  Element.prototype.releasePointerCapture = vi.fn() as unknown as typeof Element.prototype.releasePointerCapture
})

describe('DataPagination', () => {
  it('renders the current range and total', () => {
    render(<DataPagination page={0} size={10} total={45} onPageChange={vi.fn()} onSizeChange={vi.fn()} />)
    expect(screen.getByText('1–10 of 45')).toBeInTheDocument()
  })

  it('computes the range for a middle page', () => {
    render(<DataPagination page={2} size={10} total={45} onPageChange={vi.fn()} onSizeChange={vi.fn()} />)
    expect(screen.getByText('21–30 of 45')).toBeInTheDocument()
  })

  it('caps the "to" value at total on the last page', () => {
    render(<DataPagination page={4} size={10} total={45} onPageChange={vi.fn()} onSizeChange={vi.fn()} />)
    expect(screen.getByText('41–45 of 45')).toBeInTheDocument()
  })

  it('shows 0–0 of 0 when there is no data', () => {
    render(<DataPagination page={0} size={10} total={0} onPageChange={vi.fn()} onSizeChange={vi.fn()} />)
    expect(screen.getByText('0–0 of 0')).toBeInTheDocument()
  })

  it('disables Previous on the first page', () => {
    render(<DataPagination page={0} size={10} total={45} onPageChange={vi.fn()} onSizeChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })

  it('disables Next on the last page', () => {
    render(<DataPagination page={4} size={10} total={45} onPageChange={vi.fn()} onSizeChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('calls onPageChange with the next page number when Next is clicked', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<DataPagination page={1} size={10} total={45} onPageChange={onPageChange} onSizeChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange with the previous page number when Previous is clicked', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<DataPagination page={1} size={10} total={45} onPageChange={onPageChange} onSizeChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onPageChange).toHaveBeenCalledWith(0)
  })

  it('changes the page size when a new option is selected', async () => {
    const user = userEvent.setup()
    const onSizeChange = vi.fn()
    render(<DataPagination page={0} size={10} total={45} onPageChange={vi.fn()} onSizeChange={onSizeChange} />)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: '25' }))
    expect(onSizeChange).toHaveBeenCalledWith(25)
  })

  it('accepts custom sizeOptions', async () => {
    const user = userEvent.setup()
    render(<DataPagination page={0} size={5} total={45} onPageChange={vi.fn()} onSizeChange={vi.fn()} sizeOptions={[5, 15]} />)
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByRole('option', { name: '15' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '10' })).not.toBeInTheDocument()
  })
})
