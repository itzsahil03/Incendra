import type { LucideIcon } from 'lucide-react'
import { BarChart3, Cloud, Flame, LineChart, BellRing, PawPrint, Radio } from 'lucide-react'

/** Runtime-selected badge per monitoring tool, keyed off the alert's raw `source` string —
 *  no per-provider PNG/SVG assets to fetch or license (we can't legitimately redistribute
 *  real trademarked vendor logos), so each entry pairs the provider's real brand color with
 *  a generic icon that evokes it (Prometheus's flame mark, Datadog's dog mascot, etc.)
 *  rather than reproducing their actual logo artwork. */
const PROVIDER_BADGES: Record<string, { icon: LucideIcon; color: string }> = {
  datadog: { icon: PawPrint, color: '#632CA6' },
  prometheus: { icon: Flame, color: '#E6522C' },
  alertmanager: { icon: Flame, color: '#E6522C' },
  pagerduty: { icon: BellRing, color: '#06AC38' },
  cloudwatch: { icon: Cloud, color: '#FF9900' },
  'aws-cloudwatch': { icon: Cloud, color: '#FF9900' },
  azure: { icon: LineChart, color: '#0078D4' },
  'azure-monitor': { icon: LineChart, color: '#0078D4' },
  newrelic: { icon: LineChart, color: '#008C99' },
  'new-relic': { icon: LineChart, color: '#008C99' },
  grafana: { icon: BarChart3, color: '#F46800' },
}
const DEFAULT_BADGE = { icon: Radio, color: '#64748b' }

export function providerBadge(source: string) {
  return PROVIDER_BADGES[source.toLowerCase()] ?? DEFAULT_BADGE
}

export function ProviderAvatar({ source, size = 32 }: { source: string; size?: number }) {
  const { icon: Icon, color } = providerBadge(source)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <Icon style={{ width: size * 0.58, height: size * 0.58 }} />
    </div>
  )
}
