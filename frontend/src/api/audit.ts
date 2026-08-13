import { apiClient } from './client'
import type { Page } from './types'

export interface AuditRecordResponse {
  auditId: string
  orgId: string
  service: string
  action: string
  entityType: string
  entityId: string
  actorId: string
  occurredAt: string
  details: Record<string, unknown>
}

export interface AuditListParams {
  page?: number
  size?: number
  entityId?: string
  entityType?: string
  actorId?: string
  category?: string
  /** Raw producing microservice — used by the Settings > Audit Log admin page only; the
   *  main Activity page deliberately doesn't expose this (implementation detail, not
   *  user-facing). */
  service?: string
  since?: string
  until?: string
  q?: string
  /** Comma-joined account ids whose display name matched `q` client-side — see
   *  ActivityPage's username resolution — OR'd server-side into the same `q` match. */
  qActorIds?: string
  /** Comma-joined incident/alert ids whose title, description, or display id matched `q`
   *  client-side (resolved against currently-loaded incidents/alerts) — OR'd server-side
   *  into the same `q` match, so every activity for that entity surfaces regardless of
   *  whether the individual audit row itself carries a matching `_title`/`_description`. */
  qEntityIds?: string
}

export function listAudit(params: AuditListParams) {
  return apiClient.get<Page<AuditRecordResponse>>('/api/audit', { params }).then((r) => r.data)
}

export interface CategoryCount {
  count: number
  trendPct: number | null
}

export interface AuditSummaryResponse {
  total: CategoryCount
  alerts: CategoryCount
  incidents: CategoryCount
  comments: CategoryCount
  workflowChanges: CategoryCount
}

export function getAuditSummary(since: string, until?: string) {
  return apiClient.get<AuditSummaryResponse>('/api/audit/summary', { params: { since, until } }).then((r) => r.data)
}

export interface TopActionResponse {
  actionKey: string
  displayName: string
  count: number
}

export function getTopActions(since: string, until?: string, limit = 5) {
  return apiClient.get<TopActionResponse[]>('/api/audit/top-actions', { params: { since, until, limit } }).then((r) => r.data)
}

export interface TopActorResponse {
  actorId: string
  count: number
}

export function getTopActors(since: string, until?: string, limit = 5) {
  return apiClient.get<TopActorResponse[]>('/api/audit/top-actors', { params: { since, until, limit } }).then((r) => r.data)
}

export interface TopEntityResponse {
  entityId: string
  entityType: string
  count: number
}

export function getTopEntities(since: string, entityType: string, until?: string, limit = 5) {
  return apiClient.get<TopEntityResponse[]>('/api/audit/top-entities', { params: { since, until, entityType, limit } }).then((r) => r.data)
}

export interface TimeseriesPointResponse {
  bucket: string
  count: number
}

export function getTimeseries(since: string, grain: 'hour' | 'day', until?: string) {
  return apiClient.get<TimeseriesPointResponse[]>('/api/audit/timeseries', { params: { since, until, grain } }).then((r) => r.data)
}

export function getAuditEntityTypes() {
  return apiClient.get<string[]>('/api/audit/entity-types').then((r) => r.data)
}

/** A plain `<a href>` to this endpoint wouldn't carry the Authorization header the API
 *  gateway requires (auth here is a Bearer token via axios, not a cookie session), so the
 *  export goes through `apiClient` as a blob and gets turned into a client-side download
 *  (`Blob` + `URL.createObjectURL`) instead of a direct link. */
export function exportAuditCsv(params: Omit<AuditListParams, 'page' | 'size'>) {
  return apiClient.get<Blob>('/api/audit/export', { params, responseType: 'blob' }).then((r) => r.data)
}

export interface BookmarkResponse {
  auditId: string
  action: string
  displayName: string
  category: string
  entityType: string
  entityId: string
  actorId: string
  occurredAt: string
  bookmarkedAt: string
}

export function addBookmark(auditId: string) {
  return apiClient.post(`/api/audit/bookmarks/${auditId}`).then(() => undefined)
}

export function removeBookmark(auditId: string) {
  return apiClient.delete(`/api/audit/bookmarks/${auditId}`).then(() => undefined)
}

export function getBookmarkIds() {
  return apiClient.get<string[]>('/api/audit/bookmarks/ids').then((r) => r.data)
}

export function getRecentBookmarks(limit = 5) {
  return apiClient.get<BookmarkResponse[]>('/api/audit/bookmarks', { params: { limit } }).then((r) => r.data)
}
