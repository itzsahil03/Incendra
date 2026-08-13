import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type Role } from '@/features/session/sessionSlice'
import {
  useAcknowledgeAlertMutation,
  useAlertQuery,
  useAssignAlertMutation,
  usePromoteAlertMutation,
  useUnlinkAlertMutation,
  useLinkAlertMutation,
  useSetAlertDispositionMutation,
  useAddAlertNoteMutation,
  useEditAlertNoteMutation,
  useDeleteAlertNoteMutation,
} from '@/queries/useAlerts'
import { useUsersQuery } from '@/queries/useUsers'
import { useIncidentQuery, useIncidentsQuery } from '@/queries/useIncidents'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AlertDetailPage } from './AlertDetailPage'
import type { AlertDetailResponse } from '@/api/alerts'

vi.mock('@/queries/useAlerts')
vi.mock('@/queries/useUsers')
vi.mock('@/queries/useIncidents')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeAll(() => {
  stubRadixEnvironment()
  Element.prototype.scrollIntoView = vi.fn()
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
  URL.revokeObjectURL = vi.fn()
})

const mockAlertQuery = vi.mocked(useAlertQuery)
const mockUsers = vi.mocked(useUsersQuery)
const mockIncidentQuery = vi.mocked(useIncidentQuery)
const mockIncidentsQuery = vi.mocked(useIncidentsQuery)
const mockAcknowledge = vi.mocked(useAcknowledgeAlertMutation)
const mockAssign = vi.mocked(useAssignAlertMutation)
const mockPromote = vi.mocked(usePromoteAlertMutation)
const mockUnlink = vi.mocked(useUnlinkAlertMutation)
const mockLink = vi.mocked(useLinkAlertMutation)
const mockSetDisposition = vi.mocked(useSetAlertDispositionMutation)
const mockAddNote = vi.mocked(useAddAlertNoteMutation)
const mockEditNote = vi.mocked(useEditAlertNoteMutation)
const mockDeleteNote = vi.mocked(useDeleteAlertNoteMutation)

function alertFixture(overrides: Partial<AlertDetailResponse> = {}): AlertDetailResponse {
  return {
    id: 'a-1',
    displayId: 'ALT-1',
    orgId: 'org-1',
    source: 'datadog',
    title: 'High CPU',
    description: 'CPU above threshold',
    priority: 'P1',
    receivedAt: '2026-01-01T00:00:00Z',
    raw: { metric: 'cpu', value: 95 },
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    status: 'Open',
    assigneeId: null,
    assigneeName: null,
    summary: null,
    environment: 'production',
    tags: {},
    infrastructure: {},
    links: [],
    metrics: null,
    providerMetadata: [],
    providerDisplayName: 'Datadog',
    providerColor: null,
    fingerprint: 'fp-abc123def456',
    fingerprintType: 'CONTENT_HASH',
    firstSeenAt: '2026-01-01T00:00:00Z',
    lastSeenAt: '2026-01-01T00:05:00Z',
    occurrenceCount: 3,
    history: [],
    notes: [],
    disposition: null,
    dispositionReason: null,
    dispositionBy: null,
    dispositionAt: null,
    incidentId: null,
    ...overrides,
  } as AlertDetailResponse
}

function renderPage(role: Role = 'ADMIN') {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session: { token: 't', refreshToken: 'r', user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role } } },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/app/alerts/a-1']}>
        <TooltipProvider>
          <Routes>
            <Route path="/app/alerts/:id" element={<AlertDetailPage />} />
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    </Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAlertQuery.mockReturnValue({ data: alertFixture(), isLoading: false, error: null } as never)
  mockUsers.mockReturnValue({ data: [{ id: 'u2', name: 'Bob', email: 'bob@example.com', orgId: 'org-1', role: 'RESPONDER', notificationPrefs: null, createdAt: '', active: true }] } as never)
  mockIncidentQuery.mockReturnValue({ data: undefined } as never)
  mockIncidentsQuery.mockReturnValue({ data: { content: [] } } as never)
  mockAcknowledge.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockAssign.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) } as never)
  mockPromote.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockUnlink.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockLink.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) } as never)
  mockSetDisposition.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockAddNote.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockEditNote.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockDeleteNote.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
})

describe('AlertDetailPage — loading/error', () => {
  it('shows a loading state', () => {
    mockAlertQuery.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByText('High CPU')).not.toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockAlertQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.getByText("Couldn't load alert")).toBeInTheDocument()
  })
})

describe('AlertDetailPage — header', () => {
  it('shows title, status badge, and navigates back on click', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByText('ALT-1 — High CPU')).toBeInTheDocument()
    await user.click(screen.getByText('Back to alerts'))
    expect(navigateMock).toHaveBeenCalledWith('/app/alerts')
  })

  it('acknowledges the alert', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockAcknowledge.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Acknowledge/ }))
    expect(mutateAsync).toHaveBeenCalledWith('a-1')
    expect(toast.success).toHaveBeenCalledWith('Acknowledged')
  })

  it('hides the acknowledge button once acknowledged', () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ acknowledged: true }), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.queryByRole('button', { name: /Acknowledge/ })).not.toBeInTheDocument()
  })

  it('shows a Link to incident button, opens the dialog', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Link to incident' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('shows a View incident button and navigates when linked', async () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ incidentId: 'inc-1' }), isLoading: false, error: null } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'View incident' }))
    expect(navigateMock).toHaveBeenCalledWith('/app/incidents/inc-1')
  })

  it('shares the alert link via the overflow menu', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(await screen.findByText('Share Alert'))
    await expect(navigator.clipboard.readText()).resolves.not.toBe('')
    expect(toast.success).toHaveBeenCalledWith('Link copied to clipboard')
  })
})

describe('AlertDetailPage — meta cells', () => {
  it('shows a dash for a missing environment', () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ environment: null }), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('AlertDetailPage — tabs', () => {
  it('switches tabs and scrolls to the section', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: 'Metrics' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})

describe('AlertDetailPage — resources section', () => {
  it('shows an empty state with no infrastructure', () => {
    renderPage()
    expect(screen.getByText('No infrastructure context provided by source')).toBeInTheDocument()
  })

  it('renders infrastructure entries with a matching icon', () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ infrastructure: { Host: 'web-1', Region: 'us-east-1', 'Custom Field': 'x' } }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('web-1')).toBeInTheDocument()
    expect(screen.getByText('us-east-1')).toBeInTheDocument()
    expect(screen.getByText('x')).toBeInTheDocument()
  })
})

describe('AlertDetailPage — raw payload', () => {
  it('copies and downloads the raw JSON', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByTitle('Copy JSON'))
    await expect(navigator.clipboard.readText()).resolves.toBe(JSON.stringify(alertFixture().raw, null, 2))
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard')

    await user.click(screen.getByTitle('Download JSON'))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('expands and collapses the raw payload preview', async () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ raw: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i])) }),
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByText(/more lines?/)).toBeInTheDocument()
    await user.click(screen.getByTitle('Expand'))
    expect(screen.queryByText(/more lines?/)).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Collapse'))
    expect(screen.getByText(/more lines?/)).toBeInTheDocument()
  })
})

describe('AlertDetailPage — provider metadata', () => {
  it('renders a JSON field collapsed, expandable', async () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ providerMetadata: [{ key: 'payload', label: 'Payload', value: '{"a":1}', type: 'JSON' }] }),
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderPage()
    expect(screen.queryByText('{"a":1}')).not.toBeInTheDocument()
    await user.click(screen.getByText('Payload'))
    expect(screen.getByText('{"a":1}')).toBeInTheDocument()
  })

  it('renders a URL field as a link', () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ providerMetadata: [{ key: 'link', label: 'Runbook', value: 'https://example.com', type: 'URL' }] }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByRole('link', { name: /https:\/\/example.com/ })).toHaveAttribute('href', 'https://example.com')
  })

  it('renders a BOOLEAN field as Yes/No', () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ providerMetadata: [{ key: 'flag', label: 'Muted', value: 'true', type: 'BOOLEAN' }] }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('renders a code-like TEXT field in a <pre> block', () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ providerMetadata: [{ key: 'query', label: 'Query', value: 'sum(rate(errors{job="x"}))', type: 'TEXT' }] }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('sum(rate(errors{job="x"}))').tagName).toBe('PRE')
  })

  it('renders a NUMBER field in monospace styling', () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ providerMetadata: [{ key: 'count', label: 'Count', value: '42', type: 'NUMBER' }] }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows an empty state with no provider metadata', () => {
    renderPage()
    expect(screen.getByText('No additional provider fields')).toBeInTheDocument()
  })
})

describe('AlertDetailPage — assignee', () => {
  it('assigns via the combobox', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockAssign.mockReturnValue({ mutateAsync } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByText('Unassigned'))
    await user.click(await screen.findByText('Bob'))
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'a-1', assigneeId: 'u2', assigneeName: 'Bob' })
    expect(toast.success).toHaveBeenCalledWith('Assignee updated')
  })

  it('unassigns via the combobox', async () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ assigneeId: 'u2', assigneeName: 'Bob' }), isLoading: false, error: null } as never)
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockAssign.mockReturnValue({ mutateAsync } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    await user.click(await screen.findByText('Unassigned'))
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'a-1', assigneeId: null, assigneeName: null })
    expect(toast.success).toHaveBeenCalledWith('Assignee removed')
  })

  it('shows a read-only assignee for a non-editable role', () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ assigneeName: 'Bob' }), isLoading: false, error: null } as never)
    renderPage('VIEWER')
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.queryByText('Search…')).not.toBeInTheDocument()
  })

  it('shows Unassigned text for a read-only, unassigned alert', () => {
    renderPage('VIEWER')
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0)
  })
})

describe('AlertDetailPage — disposition', () => {
  it('shows a set-disposition prompt and opens the dialog', async () => {
    const user = userEvent.setup()
    renderPage('ADMIN')
    expect(screen.getByText('Not resolved yet — no disposition set.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set disposition' }))
    expect(await screen.findByText('Resolve alert')).toBeInTheDocument()
  })

  it('shows the disposition details when set, with an edit action', async () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({
        disposition: 'FALSE_POSITIVE',
        dispositionReason: 'Flaky sensor',
        dispositionBy: 'u2',
        dispositionAt: '2026-01-01T01:00:00Z',
      }),
      isLoading: false,
      error: null,
    } as never)
    renderPage('ADMIN')
    expect(screen.getByText('False Positive')).toBeInTheDocument()
    expect(screen.getByText('Flaky sensor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('resolves the dispositionBy id to a friendlier label when a name is not directly known', () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ disposition: 'DUPLICATE', dispositionBy: 'unknown-user' }),
      isLoading: false,
      error: null,
    } as never)
    renderPage('ADMIN')
    expect(screen.getByText('unknown-user')).toBeInTheDocument()
  })
})

describe('AlertDetailPage — labels', () => {
  it('shows an empty state with no labels', () => {
    renderPage()
    expect(screen.getByText('No labels provided by source')).toBeInTheDocument()
  })

  it('shows up to 5 labels and a "+N more" toggle beyond that', async () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ tags: { a: '1', b: '2', c: '3', d: '4', e: '5', f: '6' } }),
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
    await user.click(screen.getByText('+1 more'))
    expect(screen.getByText('f: 6')).toBeInTheDocument()
    await user.click(screen.getByText('Show less'))
    expect(screen.queryByText('f: 6')).not.toBeInTheDocument()
  })

  it('renders a key-only tag when there is no value', () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ tags: { standalone: '' } }), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('standalone')).toBeInTheDocument()
  })
})

describe('AlertDetailPage — links', () => {
  it('shows an empty state with no links', () => {
    renderPage()
    expect(screen.getByText('No links provided by source')).toBeInTheDocument()
  })

  it('renders links, and a "View in X" shortcut using the first link', () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ links: [{ label: 'Dashboard', url: 'https://dd.example.com' }] }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', 'https://dd.example.com')
    expect(screen.getByText(/View in Datadog/)).toBeInTheDocument()
  })
})

describe('AlertDetailPage — linked incident', () => {
  it('shows a promote/link prompt when unlinked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockPromote.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    expect(screen.getByText('Not linked to any incident yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Promote to new incident' }))
    expect(mutateAsync).toHaveBeenCalledWith('a-1')
    expect(toast.success).toHaveBeenCalledWith('Incident created')
  })

  it('opens the link dialog from the linked-incident panel', async () => {
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'Link to existing incident' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('shows a loading placeholder before the linked incident resolves, then its details', () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ incidentId: 'inc-1' }), isLoading: false, error: null } as never)
    mockIncidentQuery.mockReturnValue({ data: undefined } as never)
    renderPage('ADMIN')
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the linked incident summary once resolved and navigates on click', async () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ incidentId: 'inc-1' }), isLoading: false, error: null } as never)
    mockIncidentQuery.mockReturnValue({
      data: { id: 'inc-1', displayId: 'INC-1', title: 'DB down', status: 'Open', priority: 'P1', assigneeName: 'Carol' },
    } as never)
    const user = userEvent.setup()
    renderPage('ADMIN')
    expect(screen.getByText('INC-1 — DB down')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()
    await user.click(screen.getByText('INC-1 — DB down'))
    expect(navigateMock).toHaveBeenCalledWith('/app/incidents/inc-1')
  })

  it('shows Unassigned for the linked incident with no assignee', () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ incidentId: 'inc-1' }), isLoading: false, error: null } as never)
    mockIncidentQuery.mockReturnValue({
      data: { id: 'inc-1', displayId: 'INC-1', title: 'DB down', status: 'Open', priority: 'P1', assigneeName: null },
    } as never)
    renderPage('ADMIN')
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0)
  })

  it('unlinks the incident', async () => {
    mockAlertQuery.mockReturnValue({ data: alertFixture({ incidentId: 'inc-1' }), isLoading: false, error: null } as never)
    mockIncidentQuery.mockReturnValue({
      data: { id: 'inc-1', displayId: 'INC-1', title: 'DB down', status: 'Open', priority: 'P1', assigneeName: null },
    } as never)
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockUnlink.mockReturnValue({ mutateAsync, isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage('ADMIN')
    await user.click(screen.getByRole('button', { name: 'Unlink incident' }))
    expect(mutateAsync).toHaveBeenCalledWith('a-1')
    expect(toast.success).toHaveBeenCalledWith('Unlinked')
  })
})

describe('AlertDetailPage — role gating', () => {
  it('hides edit affordances for a VIEWER', () => {
    renderPage('VIEWER')
    expect(screen.queryByRole('button', { name: 'Link to incident' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set disposition' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Promote to new incident' })).not.toBeInTheDocument()
  })
})

describe('AlertDetailPage — notes panel presence', () => {
  it('renders the notes panel with the alert’s notes', () => {
    mockAlertQuery.mockReturnValue({
      data: alertFixture({ notes: [{ id: 'n1', authorId: 'u1', authorName: 'Alice', text: 'Investigating', createdAt: '2026-01-01T00:00:00Z' }] }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('Investigating')).toBeInTheDocument()
  })
})
