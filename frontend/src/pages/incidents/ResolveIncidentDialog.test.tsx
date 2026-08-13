import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { ResolveIncidentDialog } from './ResolveIncidentDialog'
import { useTransitionMutation } from '@/queries/useWorkflow'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/queries/useWorkflow')

const mockUseTransitionMutation = vi.mocked(useTransitionMutation)

function renderDialog({
  mutateAsync = vi.fn().mockResolvedValue({ incidentId: 'incident-1', from: 'Work in Progress', to: 'Resolved' }),
  isPending = false,
  open = true,
}: { mutateAsync?: ReturnType<typeof vi.fn>; isPending?: boolean; open?: boolean } = {}) {
  mockUseTransitionMutation.mockReturnValue({ mutateAsync, isPending } as unknown as ReturnType<typeof useTransitionMutation>)
  const onClose = vi.fn()
  const view = render(
    <ResolveIncidentDialog incidentId="incident-1" displayId="INC-1" title="Payments down" open={open} onClose={onClose} />,
  )
  return { mutateAsync, onClose, ...view }
}

describe('ResolveIncidentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the incident displayId and title', () => {
    renderDialog()
    expect(screen.getByText('INC-1 — Payments down')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Resolve incident')).not.toBeInTheDocument()
  })

  it('does not show the "Required" error before any submit attempt', () => {
    renderDialog()
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
  })

  it('marks the textarea invalid and shows "Required" when resolving with a blank note', async () => {
    const user = userEvent.setup()
    const { mutateAsync } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Resolve incident' }))

    expect(await screen.findByText('Required')).toBeInTheDocument()
    expect(screen.getByLabelText('Resolution notes *')).toHaveAttribute('aria-invalid', 'true')
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('submits the trimmed note as a transition to Resolved, toasts success, and closes', async () => {
    const user = userEvent.setup()
    const { mutateAsync, onClose } = renderDialog()

    await user.type(screen.getByLabelText('Resolution notes *'), '  Root cause fixed, deployed hotfix  ')
    await user.click(screen.getByRole('button', { name: 'Resolve incident' }))

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenCalledWith({ toState: 'Resolved', note: 'Root cause fixed, deployed hotfix' })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Incident resolved'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clears the "Required" error once text is typed after a failed attempt', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Resolve incident' }))
    expect(await screen.findByText('Required')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Resolution notes *'), 'Fixed now')
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
  })

  it('shows an error toast and does not close when the mutation rejects', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Transition rejected' } } })
    const { onClose } = renderDialog({ mutateAsync })

    await user.type(screen.getByLabelText('Resolution notes *'), 'Fixed')
    await user.click(screen.getByRole('button', { name: 'Resolve incident' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Transition rejected'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables the Resolve button while the mutation is pending', () => {
    renderDialog({ isPending: true })
    expect(screen.getByRole('button', { name: 'Resolve incident' })).toBeDisabled()
  })

  it('disables the Resolve button once touched with a blank note (whitespace only)', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.type(screen.getByLabelText('Resolution notes *'), '   ')
    await user.click(screen.getByRole('button', { name: 'Resolve incident' }))
    expect(screen.getByRole('button', { name: 'Resolve incident' })).toBeDisabled()
  })
})
