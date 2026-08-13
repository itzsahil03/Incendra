import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer, { type Role, type SessionState } from '@/features/session/sessionSlice'
import { useAddAlertNoteMutation, useDeleteAlertNoteMutation, useEditAlertNoteMutation } from '@/queries/useAlerts'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { AlertHistoryTimeline, NotesPanel, HISTORY_FILTERS } from './ActivityFeed'
import type { AlertHistoryEntry, AlertNote } from '@/api/alerts'

vi.mock('@/queries/useAlerts')
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

beforeAll(stubRadixEnvironment)

const mockAddNote = vi.mocked(useAddAlertNoteMutation)
const mockEditNote = vi.mocked(useEditAlertNoteMutation)
const mockDeleteNote = vi.mocked(useDeleteAlertNoteMutation)

function entry(overrides: Partial<AlertHistoryEntry> = {}): AlertHistoryEntry {
  return { type: 'RECEIVED', note: null, timestamp: '2026-01-01T00:00:00Z', actorId: null, actorName: null, ...overrides }
}

function note(overrides: Partial<AlertNote> = {}): AlertNote {
  return { id: 'n1', authorId: 'u1', authorName: 'Alice', text: 'Looking into it', createdAt: '2026-01-01T00:00:00Z', ...overrides }
}

function renderStore(ui: React.ReactElement, role: Role = 'ADMIN', userId = 'me') {
  const session: SessionState = { token: 't', refreshToken: 'r', user: { id: userId, email: 'me@example.com', name: 'Me', orgId: 'org-1', role } }
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAddNote.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockEditNote.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
  mockDeleteNote.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as never)
})

describe('AlertHistoryTimeline — describeHistory branches', () => {
  it('renders every history type with a sensible title', async () => {
    const history: AlertHistoryEntry[] = [
      entry({ type: 'RECEIVED', note: 'Webhook fired' }),
      entry({ type: 'ACKNOWLEDGED', actorName: 'Alice' }),
      entry({ type: 'RESOLVED', actorName: 'Bob', note: 'Resolved as False positive — flaky sensor' }),
      entry({ type: 'RESOLVED', actorName: 'Carol' }),
      entry({ type: 'STATUS_CHANGED', actorName: 'Dave', note: 'Acknowledged' }),
      entry({ type: 'PRIORITY_CHANGED', note: 'P1 -> P2' }),
      entry({ type: 'ASSIGNED', note: 'Eve' }),
      entry({ type: 'UNASSIGNED' }),
      entry({ type: 'LINKED', note: 'INC-5', actorName: 'Frank' }),
      entry({ type: 'UNLINKED', actorName: 'Grace' }),
    ]
    const user = userEvent.setup()
    render(<AlertHistoryTimeline history={history} accountLabels={new Map()} />)
    await user.click(screen.getByText('View full activity timeline →'))
    expect(screen.getByText('Webhook fired')).toBeInTheDocument()
    expect(screen.getByText('Alice acknowledged this alert')).toBeInTheDocument()
    expect(screen.getByText('False positive')).toBeInTheDocument()
    expect(screen.getByText('flaky sensor')).toBeInTheDocument()
    expect(screen.getByText('Carol resolved this alert')).toBeInTheDocument()
    expect(screen.getByText('Dave changed status to Acknowledged')).toBeInTheDocument()
    expect(screen.getByText('Priority changed')).toBeInTheDocument()
    expect(screen.getByText('Assigned to Eve')).toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByText('Linked to Incident INC-5')).toBeInTheDocument()
    expect(screen.getByText('Unlinked from incident')).toBeInTheDocument()
  })

  it('resolves the actor name from accountLabels when actorName is missing', () => {
    render(
      <AlertHistoryTimeline
        history={[entry({ type: 'ACKNOWLEDGED', actorId: 'u9', actorName: null })]}
        accountLabels={new Map([['u9', 'Zed']])}
      />,
    )
    expect(screen.getByText('Zed acknowledged this alert')).toBeInTheDocument()
  })

  it('falls back to "Someone" when there is no actor at all', () => {
    render(<AlertHistoryTimeline history={[entry({ type: 'ACKNOWLEDGED' })]} accountLabels={new Map()} />)
    expect(screen.getByText('Someone acknowledged this alert')).toBeInTheDocument()
  })

  it('omits the "by X" detail on UNLINKED when there is no actor', () => {
    render(<AlertHistoryTimeline history={[entry({ type: 'UNLINKED' })]} accountLabels={new Map()} />)
    expect(screen.getByText('Unlinked from incident')).toBeInTheDocument()
    expect(screen.queryByText(/by /)).not.toBeInTheDocument()
  })

  it('renders an unrecognized history type using its note or raw type', () => {
    render(<AlertHistoryTimeline history={[{ ...entry(), type: 'WEIRD' as never, note: 'custom note' }]} accountLabels={new Map()} />)
    expect(screen.getByText('custom note')).toBeInTheDocument()
  })
})

describe('AlertHistoryTimeline — empty/filter/sort/expand', () => {
  it('shows a generic empty message with no filter', () => {
    render(<AlertHistoryTimeline history={[]} accountLabels={new Map()} />)
    expect(screen.getByText('No history yet.')).toBeInTheDocument()
  })

  it('shows a filter-specific empty message', () => {
    render(<AlertHistoryTimeline history={[]} accountLabels={new Map()} filter="assignment" />)
    expect(screen.getByText('No assignment history yet.')).toBeInTheDocument()
  })

  it('filters entries down to the types the selected filter covers', () => {
    const history = [entry({ type: 'RECEIVED' }), entry({ type: 'ASSIGNED', note: 'Bob' })]
    render(<AlertHistoryTimeline history={history} accountLabels={new Map()} filter="assignment" />)
    expect(screen.getByText('Assigned to Bob')).toBeInTheDocument()
    expect(screen.queryByText('Alert received')).not.toBeInTheDocument()
  })

  it('sorts newest first', () => {
    const history = [
      entry({ type: 'RECEIVED', timestamp: '2026-01-01T00:00:00Z', note: 'first' }),
      entry({ type: 'RECEIVED', timestamp: '2026-01-03T00:00:00Z', note: 'third' }),
      entry({ type: 'RECEIVED', timestamp: '2026-01-02T00:00:00Z', note: 'second' }),
    ]
    const { container } = render(<AlertHistoryTimeline history={history} accountLabels={new Map()} />)
    const texts = Array.from(container.querySelectorAll('p.font-medium')).map((el) => el.textContent)
    expect(texts).toEqual(['third', 'second', 'first'])
  })

  it('collapses to 5 entries with a toggle to expand, and can collapse again', async () => {
    const history = Array.from({ length: 7 }, (_, i) => entry({ type: 'RECEIVED', note: `entry-${i}`, timestamp: `2026-01-0${i + 1}T00:00:00Z` }))
    const user = userEvent.setup()
    render(<AlertHistoryTimeline history={history} accountLabels={new Map()} />)
    expect(screen.getAllByText(/entry-/).length).toBe(5)
    await user.click(screen.getByText('View full activity timeline →'))
    expect(screen.getAllByText(/entry-/).length).toBe(7)
    await user.click(screen.getByText('Show less'))
    expect(screen.getAllByText(/entry-/).length).toBe(5)
  })

  it('does not show the expand toggle with 5 or fewer entries', () => {
    const history = Array.from({ length: 3 }, (_, i) => entry({ note: `e-${i}` }))
    render(<AlertHistoryTimeline history={history} accountLabels={new Map()} />)
    expect(screen.queryByText(/View full activity timeline/)).not.toBeInTheDocument()
  })
})

describe('NotesPanel — composing notes', () => {
  it('sends a note on click and clears the input', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockAddNote.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[]} />)
    await user.type(screen.getByPlaceholderText('Add a note…'), 'New note')
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'a-1', authorName: 'Me', text: 'New note' })
    expect(screen.getByPlaceholderText('Add a note…')).toHaveValue('')
  })

  it('sends a note on Enter, not on Shift+Enter', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockAddNote.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[]} />)
    const input = screen.getByPlaceholderText('Add a note…')
    await user.type(input, 'Shift note{Shift>}{Enter}{/Shift}')
    expect(mutateAsync).not.toHaveBeenCalled()
    await user.type(input, '{Enter}')
    expect(mutateAsync).toHaveBeenCalled()
  })

  it('does not send an empty/whitespace-only note', async () => {
    const mutateAsync = vi.fn()
    mockAddNote.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[]} />)
    await user.type(screen.getByPlaceholderText('Add a note…'), '   ')
    expect(screen.getByRole('button', { name: 'Add note' })).toBeDisabled()
  })

  it('shows a toast error if adding a note fails', async () => {
    mockAddNote.mockReturnValue({ mutateAsync: vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'nope' } } }), isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[]} />)
    await user.type(screen.getByPlaceholderText('Add a note…'), 'note')
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    expect(toast.error).toHaveBeenCalledWith('nope')
  })

  it('shows the empty state and note count badge', () => {
    renderStore(<NotesPanel alertId="a-1" notes={[]} />)
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})

describe('NotesPanel — listing, sorting, and note management', () => {
  it('shows the sort control only with more than one note, and sorts oldest/newest', async () => {
    const notes = [
      note({ id: 'n1', text: 'first', createdAt: '2026-01-01T00:00:00Z' }),
      note({ id: 'n2', text: 'second', createdAt: '2026-01-02T00:00:00Z' }),
    ]
    const user = userEvent.setup()
    const { container } = renderStore(<NotesPanel alertId="a-1" notes={notes} />)
    expect(screen.getByText('Sort:')).toBeInTheDocument()
    let texts = Array.from(container.querySelectorAll('p.text-sm.break-words')).map((el) => el.textContent)
    expect(texts).toEqual(['second', 'first'])

    await user.click(screen.getByRole('combobox'))
    const listbox = await screen.findByRole('listbox')
    await user.click(within(listbox).getByText('Oldest first'))
    texts = Array.from(container.querySelectorAll('p.text-sm.break-words')).map((el) => el.textContent)
    expect(texts).toEqual(['first', 'second'])
  })

  it('does not show the sort control with a single note', () => {
    renderStore(<NotesPanel alertId="a-1" notes={[note()]} />)
    expect(screen.queryByText('Sort:')).not.toBeInTheDocument()
  })

  it('shows edit/delete controls only for the note author or an admin', () => {
    renderStore(<NotesPanel alertId="a-1" notes={[note({ authorId: 'someone-else' })]} />, 'RESPONDER', 'me')
    expect(screen.queryByTitle('Edit note')).not.toBeInTheDocument()
  })

  it('shows edit/delete controls for the note author', () => {
    renderStore(<NotesPanel alertId="a-1" notes={[note({ authorId: 'me' })]} />, 'RESPONDER', 'me')
    expect(screen.getByTitle('Edit note')).toBeInTheDocument()
  })

  it('shows edit/delete controls for an admin on someone else’s note', () => {
    renderStore(<NotesPanel alertId="a-1" notes={[note({ authorId: 'someone-else' })]} />, 'ADMIN', 'me')
    expect(screen.getByTitle('Edit note')).toBeInTheDocument()
  })

  it('edits a note: enters edit mode, saves the trimmed text', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockEditNote.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[note({ id: 'n1', authorId: 'me', text: 'old text' })]} />, 'ADMIN', 'me')
    await user.click(screen.getByTitle('Edit note'))
    const textarea = screen.getByDisplayValue('old text')
    await user.clear(textarea)
    await user.type(textarea, '  new text  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'a-1', noteId: 'n1', text: 'new text' })
  })

  it('cancels editing without saving', async () => {
    const mutateAsync = vi.fn()
    mockEditNote.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[note({ id: 'n1', authorId: 'me', text: 'old text' })]} />, 'ADMIN', 'me')
    await user.click(screen.getByTitle('Edit note'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(screen.getByText('old text')).toBeInTheDocument()
  })

  it('does not save an edit that is unchanged or empty', async () => {
    const mutateAsync = vi.fn()
    mockEditNote.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[note({ id: 'n1', authorId: 'me', text: 'same' })]} />, 'ADMIN', 'me')
    await user.click(screen.getByTitle('Edit note'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('shows a toast error if editing fails', async () => {
    mockEditNote.mockReturnValue({ mutateAsync: vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'edit failed' } } }), isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[note({ id: 'n1', authorId: 'me', text: 'old' })]} />, 'ADMIN', 'me')
    await user.click(screen.getByTitle('Edit note'))
    const textarea = screen.getByDisplayValue('old')
    await user.type(textarea, ' more')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(toast.error).toHaveBeenCalledWith('edit failed')
  })

  it('deletes a note via the confirm dialog', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockDeleteNote.mockReturnValue({ mutateAsync, isPending: false } as never)
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[note({ id: 'n1', authorId: 'me' })]} />, 'ADMIN', 'me')
    await user.click(screen.getByTitle('Delete note'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'a-1', noteId: 'n1' })
  })

  it('shows a toast error if deleting fails', async () => {
    mockDeleteNote.mockReturnValue({ mutateAsync: vi.fn().mockRejectedValue({ isAxiosError: true, response: { data: { message: 'delete failed' } } }), isPending: false } as never)
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderStore(<NotesPanel alertId="a-1" notes={[note({ id: 'n1', authorId: 'me' })]} />, 'ADMIN', 'me')
    await user.click(screen.getByTitle('Delete note'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(toast.error).toHaveBeenCalledWith('delete failed')
  })
})

describe('HISTORY_FILTERS', () => {
  it('includes the all-events filter with no type restriction', () => {
    expect(HISTORY_FILTERS.find((f) => f.key === 'all')?.types).toBeUndefined()
  })
})
