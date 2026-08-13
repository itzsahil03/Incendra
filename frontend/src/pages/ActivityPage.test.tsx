import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import {
  useAddBookmarkMutation,
  useAuditQuery,
  useAuditSummaryQuery,
  useBookmarkIdsQuery,
  useRecentBookmarksQuery,
  useRemoveBookmarkMutation,
  useTimeseriesQuery,
  useTopActionsQuery,
  useTopActorsQuery,
  useTopEntitiesQuery,
} from '@/queries/useAudit'
import { useUsersQuery, useAllUsersQuery } from '@/queries/useUsers'
import { useIncidentsQuery } from '@/queries/useIncidents'
import { useAlertsQuery } from '@/queries/useAlerts'
import * as auditApi from '@/api/audit'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ActivityPage } from './ActivityPage'

vi.mock('@/queries/useAudit')
vi.mock('@/queries/useUsers')
vi.mock('@/queries/useIncidents')
vi.mock('@/queries/useAlerts')
vi.mock('@/api/audit', async () => ({ exportAuditCsv: vi.fn() }))

beforeAll(stubRadixEnvironment)
// A timed-out test can abort before its own `vi.useRealTimers()` cleanup runs, leaving
// fake timers active for every subsequent test in this file (userEvent's internal delays
// then never advance, hanging every later interaction) — restore unconditionally here.
afterEach(() => {
  vi.useRealTimers()
})

const mockAudit = vi.mocked(useAuditQuery)
const mockSummary = vi.mocked(useAuditSummaryQuery)
const mockTopActions = vi.mocked(useTopActionsQuery)
const mockTopActors = vi.mocked(useTopActorsQuery)
const mockTopEntities = vi.mocked(useTopEntitiesQuery)
const mockTimeseries = vi.mocked(useTimeseriesQuery)
const mockBookmarkIds = vi.mocked(useBookmarkIdsQuery)
const mockRecentBookmarks = vi.mocked(useRecentBookmarksQuery)
const mockAddBookmark = vi.mocked(useAddBookmarkMutation)
const mockRemoveBookmark = vi.mocked(useRemoveBookmarkMutation)
const mockUsers = vi.mocked(useUsersQuery)
const mockAllUsers = vi.mocked(useAllUsersQuery)
const mockIncidents = vi.mocked(useIncidentsQuery)
const mockAlerts = vi.mocked(useAlertsQuery)

function record(overrides: Record<string, unknown> = {}) {
  return {
    auditId: 'a1',
    orgId: 'org-1',
    service: 's',
    action: 'INCIDENT_CREATED',
    entityType: 'Incident',
    entityId: 'inc-1',
    actorId: 'u1',
    occurredAt: '2026-01-01T00:00:00Z',
    details: { request: { title: 'DB down' } },
    ...overrides,
  }
}

function page(content: unknown[], overrides: Record<string, unknown> = {}) {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 25, first: true, last: true, numberOfElements: content.length, empty: content.length === 0, ...overrides }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <ActivityPage />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAudit.mockReturnValue({ data: page([record()]), isLoading: false, error: null } as never)
  mockSummary.mockReturnValue({ data: { total: { count: 10 }, alerts: { count: 2 }, incidents: { count: 5 }, comments: { count: 1 }, workflowChanges: { count: 2 } } } as never)
  mockTopActions.mockReturnValue({ data: [{ actionKey: 'INCIDENT_CREATED', displayName: 'Incident Created', count: 5 }] } as never)
  mockTopActors.mockReturnValue({ data: [{ actorId: 'u1', count: 3 }] } as never)
  mockTopEntities.mockReturnValue({ data: [] } as never)
  mockTimeseries.mockReturnValue({ data: [{ bucket: '2026-01-01T00:00:00Z', count: 3 }] } as never)
  mockBookmarkIds.mockReturnValue({ data: [] } as never)
  mockRecentBookmarks.mockReturnValue({ data: [] } as never)
  mockAddBookmark.mockReturnValue({ mutate: vi.fn() } as never)
  mockRemoveBookmark.mockReturnValue({ mutate: vi.fn() } as never)
  mockUsers.mockReturnValue({ data: [{ id: 'u1', name: 'Alice', email: 'a@example.com', orgId: 'org-1', role: 'ADMIN', notificationPrefs: null, createdAt: '', active: true }] } as never)
  mockAllUsers.mockReturnValue({ data: [{ id: 'u1', name: 'Alice', active: true }] } as never)
  mockIncidents.mockReturnValue({ data: { content: [{ id: 'inc-1', displayId: 'INC-1', title: 'DB down', description: '' }] } } as never)
  mockAlerts.mockReturnValue({ data: { content: [] } } as never)
  vi.mocked(auditApi.exportAuditCsv).mockResolvedValue(new Blob(['csv']))
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
  URL.revokeObjectURL = vi.fn()
})

describe('ActivityPage — loading/error/empty', () => {
  it('shows a loading state', () => {
    mockAudit.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByText('DB down')).not.toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockAudit.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.getByText("Couldn't load activity")).toBeInTheDocument()
  })

  it('shows an empty state with no records', () => {
    mockAudit.mockReturnValue({ data: page([]), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No activity found')).toBeInTheDocument()
  })
})

describe('ActivityPage — stats and timeline', () => {
  it('shows the stat row and lists grouped-by-date activity', () => {
    renderPage()
    expect(screen.getByText('Total events')).toBeInTheDocument()
    expect(screen.getAllByText('Incident Created').length).toBeGreaterThan(0)
  })

  it('switches to the table view', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: 'Table' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('toggles grouped/ungrouped in timeline view', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('radio', { name: 'Ungrouped' }))
    expect(screen.getAllByText('Incident Created').length).toBeGreaterThan(0)
  })

  it('bookmarks and unbookmarks a record', async () => {
    const mutate = vi.fn()
    mockAddBookmark.mockReturnValue({ mutate } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Bookmark' }))
    expect(mutate).toHaveBeenCalledWith('a1')
  })

  it('removes a bookmark when already bookmarked', async () => {
    mockBookmarkIds.mockReturnValue({ data: ['a1'] } as never)
    const mutate = vi.fn()
    mockRemoveBookmark.mockReturnValue({ mutate } as never)
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Remove bookmark' }))
    expect(mutate).toHaveBeenCalledWith('a1')
  })
})

describe('ActivityPage — filters', () => {
  it('filters via search input (debounced), eventually querying with the typed text', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/Search by keyword/), 'db')
    await vi.waitFor(() => expect(mockAudit).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'db' })), { timeout: 1000 })
  })

  it('filters by category', async () => {
    const user = userEvent.setup()
    renderPage()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[0])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Workflow'))
  })

  it('filters by entity type', async () => {
    const user = userEvent.setup()
    renderPage()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[1])
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Alert'))
  })

  it('filters by actor via the combobox', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByText('User'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Alice'))
  })

  it('clears all filters', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByPlaceholderText(/Search by keyword/), 'something')
    await user.click(screen.getByRole('button', { name: 'Clear All' }))
    expect(screen.getByPlaceholderText(/Search by keyword/)).toHaveValue('')
  })

  it('toggles and uses the custom date range fields', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()
    await user.click(screen.getByRole('button', { name: /Custom date range/ }))
    expect(screen.getByText('From')).toBeInTheDocument()
    const [fromInput, toInput] = container.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')
    await user.type(fromInput, '2026-01-01T00:00')
    await user.type(toInput, '2026-01-02T00:00')
    expect(fromInput).toHaveValue('2026-01-01T00:00')
  })

  it('changes the range via the range dropdown', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Last 24 hours/ }))
    await user.click(await screen.findByText('Last 7 days'))
    expect(screen.getByRole('button', { name: /Last 7 days/ })).toBeInTheDocument()
  })
})

describe('ActivityPage — export', () => {
  it('exports the current page as CSV', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Export/ }))
    await user.click(await screen.findByText(/Export Current Page/))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('exports the filtered results as CSV via the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Export/ }))
    await user.click(await screen.findByText(/Export Filtered Results/))
    expect(auditApi.exportAuditCsv).toHaveBeenCalled()
  })
})

describe('ActivityPage — sidebar cards', () => {
  it('shows the activity overview chart when there is data', () => {
    renderPage()
    expect(screen.getByText('Activity Overview')).toBeInTheDocument()
  })

  it('shows an empty state for the chart with no activity', () => {
    mockTimeseries.mockReturnValue({ data: [] } as never)
    renderPage()
    expect(screen.getByText('No activity in this range')).toBeInTheDocument()
  })

  it('shows Top Activity Types with percentages', () => {
    renderPage()
    expect(screen.getByText('Top Activity Types')).toBeInTheDocument()
  })

  it('shows Most Active Responders resolving names via lookups', () => {
    renderPage()
    expect(screen.getByText('Most Active Responders')).toBeInTheDocument()
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
  })

  it('shows recent bookmarks and removes one', async () => {
    mockRecentBookmarks.mockReturnValue({
      data: [{ auditId: 'b1', action: 'INCIDENT_CREATED', displayName: 'Incident Created', category: 'Incident', entityType: 'Incident', entityId: 'inc-1', actorId: 'u1', occurredAt: '2026-01-01T00:00:00Z' }],
    } as never)
    const mutate = vi.fn()
    mockRemoveBookmark.mockReturnValue({ mutate } as never)
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByText('Recent Bookmarks')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove bookmark' }))
    expect(mutate).toHaveBeenCalledWith('b1')
  })

  it('shows a bookmarks empty state', () => {
    renderPage()
    expect(screen.getByText('No bookmarks yet')).toBeInTheDocument()
  })

  it('shows most active entities: incidents and alerts, with empty states', () => {
    renderPage()
    expect(screen.getByText('Most Active Entities')).toBeInTheDocument()
    expect(screen.getByText('No incident activity in this range')).toBeInTheDocument()
    expect(screen.getByText('No alert activity in this range')).toBeInTheDocument()
  })

  it('lists top incidents/alerts as links', () => {
    mockTopEntities.mockImplementation((_since, entityType) =>
      (entityType === 'Incident'
        ? { data: [{ entityId: 'inc-1', entityType: 'Incident', count: 4 }] }
        : { data: [{ entityId: 'a-1', entityType: 'Alert', count: 2 }] }) as never,
    )
    renderPage()
    expect(screen.getByRole('link', { name: /INC-1/ })).toHaveAttribute('href', '/app/incidents/inc-1')
  })
})
