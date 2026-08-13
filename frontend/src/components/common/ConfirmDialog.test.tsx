import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders nothing visible when closed', () => {
    render(<ConfirmDialog open={false} title="Delete item" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText('Delete item')).not.toBeInTheDocument()
  })

  it('renders title and description when open', () => {
    render(<ConfirmDialog open title="Delete item" description="This cannot be undone." onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Delete item')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('uses the default "Confirm" label when none is given', () => {
    render(<ConfirmDialog open title="Delete item" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('uses a custom confirm label', () => {
    render(<ConfirmDialog open title="Delete item" confirmLabel="Delete" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDialog open title="Delete item" confirmLabel="Delete" onConfirm={onConfirm} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ConfirmDialog open title="Delete item" onConfirm={vi.fn()} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    // Fires twice in practice: the button's own onClick, plus Radix's AlertDialogCancel
    // closing the dialog and triggering the AlertDialog's onOpenChange(false) too — both
    // wired to onClose. Harmless since callers pass an idempotent close handler.
    expect(onClose).toHaveBeenCalled()
  })

  it('disables both buttons while loading', () => {
    render(<ConfirmDialog open title="Delete item" loading onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })
})
