import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { EditIncidentDialog } from './EditIncidentDialog'
import { useUpdateIncidentMutation } from '@/queries/useIncidents'
import type { IncidentResponse } from '@/api/incidents'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/queries/useIncidents')

const mockUseUpdateIncidentMutation = vi.mocked(useUpdateIncidentMutation)

function buildIncident(overrides: Partial<IncidentResponse> = {}): IncidentResponse {
  return {
    id: 'incident-1',
    displayId: 'INC-1',
    orgId: 'org-1',
    title: 'Original title',
    description: 'Original description',
    priority: 'P2',
    status: 'Open',
    assigneeId: null,
    assigneeName: null,
    reporterId: null,
    reporterName: null,
    source: 'MANUAL',
    createdAt: '2026-01-01T00:00:00Z',
    resolvedAt: null,
    environment: null,
    region: null,
    businessImpact: null,
    contextNotes: null,
    affectedComponents: [],
    participants: [],
    timeline: [],
    ...overrides,
  }
}

function renderDialog({
  incident = buildIncident(),
  mutateAsync = vi.fn().mockResolvedValue(buildIncident()),
  isPending = false,
  open = true,
}: {
  incident?: IncidentResponse
  mutateAsync?: ReturnType<typeof vi.fn>
  isPending?: boolean
  open?: boolean
} = {}) {
  mockUseUpdateIncidentMutation.mockReturnValue({ mutateAsync, isPending } as unknown as ReturnType<typeof useUpdateIncidentMutation>)
  const onClose = vi.fn()
  const view = render(<EditIncidentDialog incident={incident} open={open} onClose={onClose} />)
  return { mutateAsync, onClose, ...view }
}

describe('EditIncidentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pre-fills the form fields from the incident', () => {
    renderDialog({ incident: buildIncident({ title: 'DB outage', description: 'Connections dropping' }) })
    expect(screen.getByLabelText('Title')).toHaveValue('DB outage')
    expect(screen.getByLabelText('Description')).toHaveValue('Connections dropping')
  })

  it('does not render when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Edit incident')).not.toBeInTheDocument()
  })

  it('shows a validation error and blocks submit when title is cleared', async () => {
    const user = userEvent.setup()
    const { mutateAsync } = renderDialog()

    await user.clear(screen.getByLabelText('Title'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('submits the edited title and description, shows a success toast, and closes', async () => {
    const user = userEvent.setup()
    const { mutateAsync, onClose } = renderDialog()

    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Updated title')
    await user.clear(screen.getByLabelText('Description'))
    await user.type(screen.getByLabelText('Description'), 'Updated description')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenCalledWith({ title: 'Updated title', description: 'Updated description' })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Incident updated'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows an error toast and does not close when the mutation rejects', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Update failed' } } })
    const { onClose } = renderDialog({ mutateAsync })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Update failed'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables the Save button while the mutation is pending', () => {
    renderDialog({ isPending: true })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
