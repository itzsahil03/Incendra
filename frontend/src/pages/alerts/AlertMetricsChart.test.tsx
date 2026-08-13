import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { AlertMetricsChart } from './AlertMetricsChart'
import type { AlertMetrics } from '@/api/alerts'

// Stub out recharts' internals — jsdom gives them 0x0 layout so the real SVG never
// renders meaningfully. Replacing with lightweight stubs lets us assert on the data
// this component computes/passes down (the window filter, series mapping) instead of
// third-party rendering internals.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ data, children }: { data: unknown; children: ReactNode }) => (
    <div data-testid="line-chart" data-points={JSON.stringify(data)}>
      {children}
    </div>
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="chart-tooltip" />,
  Line: () => <div data-testid="chart-line" />,
}))

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

function point(hoursAgo: number, value: number, nowMs: number) {
  return { timestamp: new Date(nowMs - hoursAgo * 3_600_000).toISOString(), value }
}

function buildMetrics(overrides: Partial<AlertMetrics> = {}, nowMs = Date.now()): AlertMetrics {
  return {
    name: 'CPU Usage',
    unit: '%',
    currentValue: 92,
    averageValue: 60,
    maxValue: 95,
    series: [point(0.1, 92, nowMs), point(2, 70, nowMs), point(10, 50, nowMs), point(30, 20, nowMs)],
    ...overrides,
  }
}

describe('AlertMetricsChart', () => {
  it('shows an empty state when metrics is null', () => {
    render(<AlertMetricsChart metrics={null} />)
    expect(screen.getByText('No metrics provided by source')).toBeInTheDocument()
  })

  it('shows an empty state when metrics has an empty series', () => {
    render(<AlertMetricsChart metrics={buildMetrics({ series: [] })} />)
    expect(screen.getByText('No metrics provided by source')).toBeInTheDocument()
  })

  it('renders name, unit, current/average/max values', () => {
    render(<AlertMetricsChart metrics={buildMetrics()} />)
    expect(screen.getByText('CPU Usage (%)')).toBeInTheDocument()
    expect(screen.getByText('92 %')).toBeInTheDocument()
    expect(screen.getByText('60 %')).toBeInTheDocument()
    expect(screen.getByText('95 %')).toBeInTheDocument()
  })

  it('renders the metric name without parens when unit is missing', () => {
    render(<AlertMetricsChart metrics={buildMetrics({ unit: null })} />)
    expect(screen.getByText('CPU Usage')).toBeInTheDocument()
  })

  it('shows a dash when current/average/max values are null', () => {
    render(<AlertMetricsChart metrics={buildMetrics({ currentValue: null, averageValue: null, maxValue: null, unit: null })} />)
    expect(screen.getAllByText('—')).toHaveLength(3)
  })

  it('defaults to the 1h window, showing only points within the last hour', () => {
    const now = Date.now()
    render(<AlertMetricsChart metrics={buildMetrics({}, now)} />)
    const chart = screen.getByTestId('line-chart')
    const points = JSON.parse(chart.getAttribute('data-points') ?? '[]')
    // Only the 0.1h-old point falls within the 1h window
    expect(points).toHaveLength(1)
  })

  it('switching to the 6h window includes more points', async () => {
    const user = userEvent.setup()
    const now = Date.now()
    render(<AlertMetricsChart metrics={buildMetrics({}, now)} />)

    await user.click(screen.getByRole('radio', { name: '6h' }))

    const chart = screen.getByTestId('line-chart')
    const points = JSON.parse(chart.getAttribute('data-points') ?? '[]')
    // 0.1h and 2h old points fall within 6h; 10h and 30h do not
    expect(points).toHaveLength(2)
  })

  it('switching to the 24h window includes even more points', async () => {
    const user = userEvent.setup()
    const now = Date.now()
    render(<AlertMetricsChart metrics={buildMetrics({}, now)} />)

    await user.click(screen.getByRole('radio', { name: '24h' }))

    const chart = screen.getByTestId('line-chart')
    const points = JSON.parse(chart.getAttribute('data-points') ?? '[]')
    // 0.1h, 2h, 10h fall within 24h; 30h does not
    expect(points).toHaveLength(3)
  })

  it('ignores a null toggle-group value (re-clicking the active option)', async () => {
    const user = userEvent.setup()
    const now = Date.now()
    render(<AlertMetricsChart metrics={buildMetrics({}, now)} />)

    // Clicking the already-active "1h" toggle would emit an empty value from
    // the underlying ToggleGroup (type="single"); the handler should no-op.
    await user.click(screen.getByRole('radio', { name: '1h' }))

    const chart = screen.getByTestId('line-chart')
    const points = JSON.parse(chart.getAttribute('data-points') ?? '[]')
    expect(points).toHaveLength(1)
  })
})
