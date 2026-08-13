import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { SecretRevealDialog } from './SecretRevealDialog'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('SecretRevealDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    render(<SecretRevealDialog open={false} label="API Key" secret="secret-value" onClose={vi.fn()} />)
    expect(screen.queryByText('API Key')).not.toBeInTheDocument()
  })

  it('shows the label and the secret value in a readonly input when open', () => {
    render(<SecretRevealDialog open label="API Key" secret="whsec_abc123" onClose={vi.fn()} />)
    expect(screen.getByText('API Key')).toBeInTheDocument()
    const input = screen.getByDisplayValue('whsec_abc123') as HTMLInputElement
    expect(input).toHaveAttribute('readonly')
  })

  it('warns the secret will not be shown again', () => {
    render(<SecretRevealDialog open label="API Key" secret="secret" onClose={vi.fn()} />)
    expect(screen.getByText(/won't be shown again/)).toBeInTheDocument()
  })

  it('copies the secret to the clipboard and shows a toast when Copy is clicked', async () => {
    // userEvent.setup() installs its own emulated navigator.clipboard (overwriting any
    // custom mock defined beforehand) — so verify through that real emulation via
    // readText() rather than trying to out-mock it.
    const user = userEvent.setup()
    render(<SecretRevealDialog open label="API Key" secret="whsec_abc123" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /copy/i }))
    await expect(navigator.clipboard.readText()).resolves.toBe('whsec_abc123')
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard')
  })

  it('calls onClose when Done is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SecretRevealDialog open label="API Key" secret="secret" onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
