import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLiveMetrics, useMetricsSummaryQuery } from '@/queries/useAnalytics'
import { useAlertsSummaryQuery } from '@/queries/useAlerts'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { AnalyticsPage } from './AnalyticsPage'
import type { MetricsSummaryResponse } from '@/api/analytics'

vi.mock('@/queries/useAnalytics')
vi.mock('@/queries/useAlerts')

beforeAll(stubRadixEnvironment)

const mockMetrics = vi.mocked(useMetricsSummaryQuery)
const mockLive = vi.mocked(useLiveMetrics)
const mockAlertsSummary = vi.mocked(useAlertsSummaryQuery)

function metrics(overrides: Partial<MetricsSummaryResponse> = {}): MetricsSummaryResponse {
  return {
    orgId: 'org-1',
    totalIncidents: 12,
    openIncidents: 3,
    resolvedIncidents: 9,
    mttrMinutes: 45,
    mttaMinutes: 5,
    mttrTodayMinutes: 10,
    mttaTodayMinutes: 2,
    byPriority: { P1: 2, P2: 5, P3: 5 },
    byStatus: { Open: 3, Resolved: 9 },
    byPriorityStatus: { P1: { Open: 1, Resolved: 1 }, P2: { Open: 2, Resolved: 3 } },
    volumeByDay: { '2026-01-01': 3, '2026-01-02': 4, '2026-02-01': 5 },
    peakHours: { '9': 2, '14': 5 },
    resolutionTimeBuckets: { '0-15m': 2, '15-30m': 1, '30-60m': 0, '1-2h': 0, '2h+': 0 },
    byAssignee: [{ assignee: 'Alice', resolvedCount: 5, avgMttrMinutes: 20, avgMttaMinutes: 3 }],
    trend: [{ generatedAt: '2026-01-01T00:00:00Z', mttrMinutes: 30, mttaMinutes: 4 }],
    generatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  } as MetricsSummaryResponse
}

function renderPage() {
  return render(<AnalyticsPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMetrics.mockReturnValue({ data: metrics(), isLoading: false, error: null } as never)
  mockLive.mockReturnValue({ connected: true } as never)
  mockAlertsSummary.mockReturnValue({ data: { total: 20, acknowledged: 15, unacknowledged: 5 } } as never)
})

describe('AnalyticsPage — loading/error', () => {
  it('shows a loading state while metrics load', () => {
    mockMetrics.mockReturnValue({ data: undefined, isLoading: true, error: null } as never)
    renderPage()
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
  })

  it('shows an error state when metrics fail', () => {
    mockMetrics.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    renderPage()
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
  })
})

describe('AnalyticsPage — live indicator and stats', () => {
  it('shows Live when the SSE stream is connected', () => {
    renderPage()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows Reconnecting when not connected', () => {
    mockLive.mockReturnValue({ connected: false } as never)
    renderPage()
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument()
  })

  it('shows the top-line stats including alerts summary', () => {
    renderPage()
    expect(screen.getByText('Total incidents')).toBeInTheDocument()
    expect(screen.getByText('20 / 15')).toBeInTheDocument()
  })

  it('shows a dash for alerts when the summary has not loaded yet', () => {
    mockAlertsSummary.mockReturnValue({ data: undefined } as never)
    renderPage()
    expect(screen.getByText('Alert noise')).toBeInTheDocument()
  })
})

describe('AnalyticsPage — monthly growth', () => {
  it('shows a positive growth percentage across two months of data', () => {
    renderPage()
    expect(screen.getByText('Monthly growth')).toBeInTheDocument()
    // Jan: 7, Feb: 5 -> negative growth in this fixture
    expect(screen.getByText(/%$/)).toBeInTheDocument()
  })

  it('shows a dash when there is less than two months of volume data', () => {
    mockMetrics.mockReturnValue({ data: metrics({ volumeByDay: { '2026-01-01': 3 } }), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('Monthly growth')).toBeInTheDocument()
  })
})

describe('AnalyticsPage — charts and empty states', () => {
  it('shows the trend fallback message when there is no trend history', () => {
    mockMetrics.mockReturnValue({ data: metrics({ trend: [] }), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText(/Not enough history yet/)).toBeInTheDocument()
  })

  it('shows the priority distribution fallback when all counts are zero', () => {
    mockMetrics.mockReturnValue({ data: metrics({ byPriority: { P1: 0, P2: 0 } }), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No incidents yet.')).toBeInTheDocument()
  })

  it('shows the volume fallback message with no incidents in range', () => {
    mockMetrics.mockReturnValue({ data: metrics({ volumeByDay: {} }), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No incidents in the last 90 days.')).toBeInTheDocument()
  })

  it('switches the volume chart grain via the toggle group', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('radio', { name: 'Week' }))
    await user.click(screen.getByRole('radio', { name: 'Month' }))
  })

  it('shows the resolution-time fallback when all buckets are zero', () => {
    mockMetrics.mockReturnValue({
      data: metrics({ resolutionTimeBuckets: { '0-15m': 0, '15-30m': 0, '30-60m': 0, '1-2h': 0, '2h+': 0 } }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('No resolved incidents yet.')).toBeInTheDocument()
  })

  it('shows the status × priority heatmap fallback with no incidents', () => {
    mockMetrics.mockReturnValue({ data: metrics({ byPriorityStatus: {} }), isLoading: false, error: null } as never)
    renderPage()
    const cards = screen.getAllByText('No incidents yet.')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('renders the status × priority heatmap grid when there is data', () => {
    renderPage()
    expect(screen.getByText('Incidents by status × priority')).toBeInTheDocument()
    expect(screen.getByText('P1')).toBeInTheDocument()
  })

  it('renders the engineer performance table with resolved-incident stats', () => {
    renderPage()
    const row = screen.getByText('Alice').closest('tr')!
    expect(row).toHaveTextContent('5') // resolvedCount
    expect(row).toHaveTextContent('20') // avgMttrMinutes
  })

  it('shows a fallback message when no one has resolved anything yet', () => {
    mockMetrics.mockReturnValue({ data: metrics({ byAssignee: [] }), isLoading: false, error: null } as never)
    renderPage()
    expect(screen.getByText('No resolved incidents yet.')).toBeInTheDocument()
  })

  it('shows a dash for avg MTTA of zero', () => {
    mockMetrics.mockReturnValue({
      data: metrics({ byAssignee: [{ assignee: 'Bob', resolvedCount: 1, avgMttrMinutes: 5, avgMttaMinutes: 0 }] }),
      isLoading: false,
      error: null,
    } as never)
    renderPage()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })
})
