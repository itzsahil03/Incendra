import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { ImpactContextDialog } from './ImpactContextDialog'
import { useUpdateContextMutation } from '@/queries/useIncidents'
import type { IncidentResponse } from '@/api/incidents'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/queries/useIncidents')

const mockUseUpdateContextMutation = vi.mocked(useUpdateContextMutation)

function buildIncident(overrides: Partial<IncidentResponse> = {}): IncidentResponse {
  return {
    id: 'incident-1',
    displayId: 'INC-1',
    orgId: 'org-1',
    title: 'Something broke',
    description: '',
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
  mockUseUpdateContextMutation.mockReturnValue({ mutateAsync, isPending } as unknown as ReturnType<typeof useUpdateContextMutation>)
  const onClose = vi.fn()
  const view = render(<ImpactContextDialog incident={incident} open={open} onClose={onClose} />)
  return { mutateAsync, onClose, ...view }
}

describe('ImpactContextDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Edit impact & context')).not.toBeInTheDocument()
  })

  it('pre-fills fields from the incident, defaulting missing values to empty', () => {
    renderDialog({
      incident: buildIncident({
        environment: 'production',
        region: 'us-east-1',
        businessImpact: 'Full outage',
        affectedComponents: ['api', 'db'],
        contextNotes: 'Investigating',
      }),
    })
    expect(screen.getByLabelText('Environment')).toHaveValue('production')
    expect(screen.getByLabelText('Region')).toHaveValue('us-east-1')
    expect(screen.getByLabelText('Business impact')).toHaveValue('Full outage')
    expect(screen.getByLabelText('Notes')).toHaveValue('Investigating')
    expect(screen.getByText('api')).toBeInTheDocument()
    expect(screen.getByText('db')).toBeInTheDocument()
  })

  it('defaults blank text fields when the incident has no context recorded', () => {
    renderDialog()
    expect(screen.getByLabelText('Environment')).toHaveValue('')
    expect(screen.getByLabelText('Region')).toHaveValue('')
    expect(screen.getByLabelText('Business impact')).toHaveValue('')
    expect(screen.getByLabelText('Notes')).toHaveValue('')
  })

  it('saves trimmed field values, converting blanks to null, and keeps typed components', async () => {
    const user = userEvent.setup()
    const { mutateAsync, onClose } = renderDialog()

    await user.type(screen.getByLabelText('Environment'), '  staging  ')
    await user.type(screen.getByLabelText('Region'), 'eu-west-1')
    await user.type(screen.getByLabelText('Business impact'), 'Degraded performance')
    await user.type(screen.getByLabelText('Notes'), 'Some notes')
    await user.type(screen.getByPlaceholderText('Type a component, press Enter'), 'checkout-service{enter}')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenCalledWith({
      environment: 'staging',
      region: 'eu-west-1',
      businessImpact: 'Degraded performance',
      affectedComponents: ['checkout-service'],
      contextNotes: 'Some notes',
    })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Impact & context updated'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sends null for blank optional text fields', async () => {
    const user = userEvent.setup()
    const { mutateAsync } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutateAsync).toHaveBeenCalledWith({
      environment: null,
      region: null,
      businessImpact: null,
      affectedComponents: [],
      contextNotes: null,
    })
  })

  it('removes an affected component tag via its remove button', async () => {
    const user = userEvent.setup()
    const { mutateAsync } = renderDialog({ incident: buildIncident({ affectedComponents: ['api', 'db'] }) })

    await user.click(screen.getByRole('button', { name: 'Remove api' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ affectedComponents: ['db'] }))
  })

  it('shows an error toast and does not close when the mutation rejects', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Save failed' } } })
    const { onClose } = renderDialog({ mutateAsync })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Save failed'))
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
