import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkIncidentDialog } from './LinkIncidentDialog'
import { useLinkAlertMutation } from '@/queries/useAlerts'
import { useIncidentsQuery } from '@/queries/useIncidents'
import type { AlertResponse } from '@/api/alerts'
import type { IncidentResponse } from '@/api/incidents'
import type { Page } from '@/api/types'

vi.mock('@/queries/useAlerts')
vi.mock('@/queries/useIncidents')

const mockUseLinkAlertMutation = vi.mocked(useLinkAlertMutation)
const mockUseIncidentsQuery = vi.mocked(useIncidentsQuery)

function buildAlert(overrides: Partial<AlertResponse> = {}): AlertResponse {
  return {
    id: 'alert-1',
    displayId: 'ALT-1',
    orgId: 'org-1',
    source: 'datadog',
    title: 'High CPU',
    description: 'desc',
    priority: 'P1',
    receivedAt: '2026-01-01T00:00:00Z',
    raw: {},
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    status: 'Open',
    assigneeId: null,
    assigneeName: null,
    incidentId: null,
    providerDisplayName: 'Datadog',
    providerColor: null,
    ...overrides,
  }
}

function buildIncident(overrides: Partial<IncidentResponse> = {}): IncidentResponse {
  return {
    id: 'inc-1',
    displayId: 'INC-1',
    orgId: 'org-1',
    title: 'Outage',
    description: 'desc',
    priority: 'P1',
    status: 'Open',
    assigneeId: null,
    assigneeName: null,
    reporterId: null,
    reporterName: null,
    source: 'manual',
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

function buildPage(content: IncidentResponse[]): Page<IncidentResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 100,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  }
}

function renderDialog({
  alert = buildAlert(),
  open = true,
  onClose = vi.fn(),
  incidents = buildPage([buildIncident()]),
  linkMutateAsync = vi.fn().mockResolvedValue(undefined),
}: {
  alert?: AlertResponse | null
  open?: boolean
  onClose?: () => void
  incidents?: Page<IncidentResponse> | undefined
  linkMutateAsync?: ReturnType<typeof vi.fn>
} = {}) {
  mockUseIncidentsQuery.mockReturnValue({ data: incidents } as unknown as ReturnType<typeof useIncidentsQuery>)
  mockUseLinkAlertMutation.mockReturnValue({
    mutateAsync: linkMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useLinkAlertMutation>)

  return render(<LinkIncidentDialog alert={alert} open={open} onClose={onClose} />)
}

describe('LinkIncidentDialog', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false) as unknown as typeof Element.prototype.hasPointerCapture
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render dialog content when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the alert displayId in the title and lists incident options', async () => {
    const user = userEvent.setup()
    renderDialog({ alert: buildAlert({ displayId: 'ALT-42' }), incidents: buildPage([buildIncident({ id: 'inc-9', displayId: 'INC-9', title: 'DB down' })]) })

    expect(screen.getByText(/Link ALT-42 to an existing incident/)).toBeInTheDocument()
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByText('INC-9 — DB down')).toBeInTheDocument()
  })

  it('keeps the Link button disabled until an incident is selected', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Link' })).toBeDisabled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderDialog({ onClose })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('selects an incident, links it, and closes on success', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const linkMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderDialog({
      alert: buildAlert({ id: 'alert-7' }),
      incidents: buildPage([buildIncident({ id: 'inc-3', displayId: 'INC-3', title: 'Latency spike' })]),
      onClose,
      linkMutateAsync,
    })

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('INC-3 — Latency spike'))

    const linkButton = screen.getByRole('button', { name: 'Link' })
    expect(linkButton).toBeEnabled()
    await user.click(linkButton)

    expect(linkMutateAsync).toHaveBeenCalledWith({ id: 'alert-7', incidentId: 'inc-3' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a toast and does not close when the link mutation fails', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const linkMutateAsync = vi.fn().mockRejectedValue(new Error('network fail'))
    renderDialog({
      incidents: buildPage([buildIncident({ id: 'inc-3', displayId: 'INC-3', title: 'Latency spike' })]),
      onClose,
      linkMutateAsync,
    })

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('INC-3 — Latency spike'))
    await user.click(screen.getByRole('button', { name: 'Link' }))

    expect(linkMutateAsync).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders with no incidents available without crashing', () => {
    renderDialog({ incidents: buildPage([]) })
    expect(screen.getByRole('button', { name: 'Link' })).toBeDisabled()
  })

  it('handles alert=null (no displayId) gracefully', () => {
    renderDialog({ alert: null })
    expect(screen.getByText(/Link.*to an existing incident/)).toBeInTheDocument()
  })
})
