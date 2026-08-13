import { apiClient } from './client'

export interface TrendPoint {
  generatedAt: string
  totalIncidents: number
  openIncidents: number
  mttrMinutes: number
  mttaMinutes: number
}

export interface AssigneeStat {
  assignee: string
  resolvedCount: number
  avgMttrMinutes: number
  avgMttaMinutes: number
}

export interface MetricsSummaryResponse {
  orgId: string
  totalIncidents: number
  openIncidents: number
  resolvedIncidents: number
  mttrMinutes: number
  mttaMinutes: number
  mttrTodayMinutes: number
  mttaTodayMinutes: number
  byPriority: Record<string, number>
  byStatus: Record<string, number>
  byPriorityStatus: Record<string, Record<string, number>>
  volumeByDay: Record<string, number>
  peakHours: Record<string, number>
  resolutionTimeBuckets: Record<string, number>
  byAssignee: AssigneeStat[]
  trend: TrendPoint[]
  generatedAt: string
}

export function getMetricsSummary() {
  return apiClient.get<MetricsSummaryResponse>('/api/analytics/summary').then((r) => r.data)
}
