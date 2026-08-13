import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetDispositionDialog } from './SetDispositionDialog'
import { useSetAlertDispositionMutation } from '@/queries/useAlerts'
import type { AlertDetailResponse } from '@/api/alerts'

vi.mock('@/queries/useAlerts')

const mockUseSetAlertDispositionMutation = vi.mocked(useSetAlertDispositionMutation)

function buildAlert(overrides: Partial<AlertDetailResponse> = {}): AlertDetailResponse {
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
    summary: null,
    environment: null,
    tags: {},
    infrastructure: {},
    links: [],
    metrics: null,
    providerMetadata: [],
    fingerprint: null,
    fingerprintType: 'CONTENT_HASH',
    firstSeenAt: '2026-01-01T00:00:00Z',
    lastSeenAt: '2026-01-01T00:00:00Z',
    occurrenceCount: 1,
    history: [],
    notes: [],
    disposition: null,
    dispositionReason: null,
    dispositionBy: null,
    dispositionAt: null,
    ...overrides,
  }
}

function renderDialog({
  alert = buildAlert(),
  open = true,
  onClose = vi.fn(),
  setDispositionMutateAsync = vi.fn().mockResolvedValue(undefined),
  isPending = false,
}: {
  alert?: AlertDetailResponse
  open?: boolean
  onClose?: () => void
  setDispositionMutateAsync?: ReturnType<typeof vi.fn>
  isPending?: boolean
} = {}) {
  mockUseSetAlertDispositionMutation.mockReturnValue({
    mutateAsync: setDispositionMutateAsync,
    isPending,
  } as unknown as ReturnType<typeof useSetAlertDispositionMutation>)

  return render(<SetDispositionDialog alert={alert} open={open} onClose={onClose} />)
}

describe('SetDispositionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows alert displayId and title in the header', () => {
    renderDialog({ alert: buildAlert({ displayId: 'ALT-99', title: 'Disk full' }) })
    expect(screen.getByText('ALT-99 — Disk full')).toBeInTheDocument()
  })

  it('renders all disposition options', () => {
    renderDialog()
    expect(screen.getByText('Action Required')).toBeInTheDocument()
    expect(screen.getByText('False Positive')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Suppressed')).toBeInTheDocument()
    expect(screen.getByText('Auto Recovered')).toBeInTheDocument()
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('pre-selects the existing disposition and reason when editing', () => {
    renderDialog({ alert: buildAlert({ disposition: 'FALSE_POSITIVE', dispositionReason: 'Known noisy check' }) })
    expect(screen.getByDisplayValue('Known noisy check')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resolve as False Positive/ })).toBeInTheDocument()
  })

  it('does not show validation errors before interacting (untouched)', () => {
    renderDialog()
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
  })

  it('shows validation errors after clicking Resolve with nothing filled', async () => {
    const user = userEvent.setup()
    const setDispositionMutateAsync = vi.fn()
    renderDialog({ setDispositionMutateAsync })

    await user.click(screen.getByRole('button', { name: 'Resolve' }))

    expect(screen.getByText('Required', { selector: 'span.text-destructive' })).toBeInTheDocument()
    expect(setDispositionMutateAsync).not.toHaveBeenCalled()
  })

  it('selecting a disposition updates the button label and clears the disposition-required error', async () => {
    const user = userEvent.setup()
    renderDialog()

    // touch validation first
    await user.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)

    await user.click(screen.getByText('Duplicate'))
    expect(screen.getByRole('button', { name: /Resolve as Duplicate/ })).toBeInTheDocument()
  })

  it('calls the mutation with trimmed reason and disposition, then closes on success', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const setDispositionMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderDialog({ alert: buildAlert({ id: 'alert-55' }), onClose, setDispositionMutateAsync })

    await user.click(screen.getByText('Test'))
    await user.type(screen.getByLabelText(/Resolution notes/), '  Scheduled test run  ')
    await user.click(screen.getByRole('button', { name: /Resolve as Test/ }))

    expect(setDispositionMutateAsync).toHaveBeenCalledWith({
      id: 'alert-55',
      disposition: 'TEST',
      reason: 'Scheduled test run',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows an error toast and does not close when the mutation rejects', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const setDispositionMutateAsync = vi.fn().mockRejectedValue(new Error('boom'))
    renderDialog({ onClose, setDispositionMutateAsync })

    await user.click(screen.getByText('Auto Recovered'))
    await user.type(screen.getByLabelText(/Resolution notes/), 'self healed')
    await user.click(screen.getByRole('button', { name: /Resolve as Auto Recovered/ }))

    expect(setDispositionMutateAsync).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderDialog({ onClose })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables the Resolve button while the mutation is pending', () => {
    renderDialog({ isPending: true })
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeDisabled()
  })
})
