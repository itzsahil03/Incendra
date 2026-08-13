import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useIncidentSearchQuery } from '@/queries/useIncidents'
import { useAlertSearchQuery } from '@/queries/useAlerts'
import { GlobalSearchBar } from './GlobalSearchBar'

vi.mock('@/queries/useIncidents')
vi.mock('@/queries/useAlerts')

const mockUseIncidentSearchQuery = vi.mocked(useIncidentSearchQuery)
const mockUseAlertSearchQuery = vi.mocked(useAlertSearchQuery)

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

function renderBar() {
  return render(<GlobalSearchBar />, { wrapper: MemoryRouter })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseIncidentSearchQuery.mockReturnValue({ data: { content: [] } } as never)
  mockUseAlertSearchQuery.mockReturnValue({ data: { content: [] } } as never)
})

describe('GlobalSearchBar', () => {
  it('shows nothing before the input is focused', () => {
    renderBar()
    expect(screen.queryByText(/No matches/)).not.toBeInTheDocument()
  })

  it('shows a no-matches message once focused with a query and no results', async () => {
    const user = userEvent.setup()
    renderBar()
    const input = screen.getByPlaceholderText('Search incidents or alerts…')
    await user.click(input)
    await user.type(input, 'xyz')
    await waitFor(() => expect(screen.getByText('No matches for "xyz".')).toBeInTheDocument(), { timeout: 2000 })
  })

  it('lists matching incidents and navigates to the incident on click', async () => {
    mockUseIncidentSearchQuery.mockReturnValue({
      data: { content: [{ id: 'inc-1', displayId: 'INC-1', title: 'DB down', description: 'Postgres is down', priority: 'P1', status: 'OPEN', assigneeName: null }] },
    } as never)
    const user = userEvent.setup()
    renderBar()
    const input = screen.getByPlaceholderText('Search incidents or alerts…')
    await user.click(input)
    await user.type(input, 'db')

    await waitFor(() => expect(screen.getByText('DB down')).toBeInTheDocument(), { timeout: 2000 })
    expect(screen.getByText('Incidents')).toBeInTheDocument()
    await user.click(screen.getByText('DB down'))
    expect(navigateMock).toHaveBeenCalledWith('/app/incidents/inc-1')
  })

  it('lists matching alerts and navigates to the alerts list on click', async () => {
    mockUseAlertSearchQuery.mockReturnValue({
      data: { content: [{ id: 'a-1', displayId: 'ALT-1', title: 'High CPU', description: '', priority: 'P2', status: 'OPEN', assigneeName: 'Bob' }] },
    } as never)
    const user = userEvent.setup()
    renderBar()
    const input = screen.getByPlaceholderText('Search incidents or alerts…')
    await user.click(input)
    await user.type(input, 'cpu')

    await waitFor(() => expect(screen.getByText('High CPU')).toBeInTheDocument(), { timeout: 2000 })
    expect(screen.getByText('Alerts')).toBeInTheDocument()
    await user.click(screen.getByText('High CPU'))
    expect(navigateMock).toHaveBeenCalledWith('/app/alerts')
  })

  it('shows a hover preview card with the description and status', async () => {
    mockUseIncidentSearchQuery.mockReturnValue({
      data: { content: [{ id: 'inc-1', displayId: 'INC-1', title: 'DB down', description: 'Postgres is down', priority: 'P1', status: 'OPEN', assigneeName: null }] },
    } as never)
    const user = userEvent.setup()
    renderBar()
    const input = screen.getByPlaceholderText('Search incidents or alerts…')
    await user.click(input)
    await user.type(input, 'db')
    await waitFor(() => expect(screen.getByText('DB down')).toBeInTheDocument(), { timeout: 2000 })

    await user.hover(screen.getByText('DB down'))
    expect(screen.getByText('Postgres is down')).toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('clears the query when clicking outside', async () => {
    const user = userEvent.setup()
    renderBar()
    const input = screen.getByPlaceholderText('Search incidents or alerts…')
    await user.click(input)
    await user.type(input, 'xyz')
    await waitFor(() => expect(screen.getByText(/No matches/)).toBeInTheDocument(), { timeout: 2000 })

    await user.click(document.body)
    expect(screen.queryByText(/No matches/)).not.toBeInTheDocument()
  })
})
