import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  TrendingUp,
  ArrowLeftRight,
  Link as LinkIcon,
  Unlink,
  ArrowUp,
  CircleCheck,
  UserPlus,
  UserMinus,
  BellRing,
  BellPlus,
  FileEdit,
  Trash2,
  Circle,
  MessageCircle,
  Pencil,
  ClipboardCheck,
  UserRoundPlus,
  UserRoundMinus,
  Globe,
} from 'lucide-react'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { Badge } from '@/components/ui/badge'
import type { AuditRecordResponse } from '@/api/audit'
import type { IncidentResponse } from '@/api/incidents'
import type { AlertResponse } from '@/api/alerts'

export interface ActivityLookups {
  incidentById: Map<string, IncidentResponse>
  alertById: Map<string, AlertResponse>
  nameById: Map<string, string>
  /** Lowercased displayId ("inc000021") -> internal id, so the Activity search box can
   *  resolve a human-typed incident/alert id to the raw id audit records are keyed by. */
  incidentIdByDisplayId: Map<string, string>
  alertIdByDisplayId: Map<string, string>
}

export type ActivityCategory = 'Workflow' | 'Alert' | 'Incident' | 'Comment' | 'System'

export const CATEGORY_BADGE_COLOR: Record<ActivityCategory, string> = {
  Workflow: '#938ede',
  Alert: '#e5766c',
  Incident: '#6d95e0',
  Comment: '#4dd0c4',
  System: 'rgba(255,255,255,0.55)',
}

export interface ActivityTypeDefinition {
  icon: LucideIcon
  bg: string
  fg: string
  label: string
  category: ActivityCategory
  /** Reserved for future filtering/styling (e.g. muting system-generated rows) — a
   *  human-triggered action vs. one the platform generates on its own. */
  isUserAction: boolean
  isSystemAction: boolean
}

/** Single source of truth per action for icon, color, display label, and category —
 *  mirrors (but is necessarily a separate copy of, since Java and TypeScript can't share
 *  one object across services) the backend's own `ActivityActionCatalog`, which owns the
 *  same category groupings for the stat cards and the "Top Activity Types" widget's
 *  labels. Actions not listed here still render sensibly via {@link activityType}'s
 *  fallback — they just don't get a named category or a specific icon/color. */
const ACTIVITY_TYPES: Record<string, Omit<ActivityTypeDefinition, 'isUserAction' | 'isSystemAction'>> = {
  // Both an incident's workflow transition and an alert's status change/ack are "workflow"
  // activity — grouped under the same category so filtering by Workflow surfaces both —
  // but the icon color stays distinct per action (purple for incident, red/green for
  // alert) so the two remain visually tellable apart at a glance.
  WORKFLOW_TRANSITIONED: { icon: ArrowLeftRight, bg: 'rgba(147,142,222,0.16)', fg: '#938ede', label: 'Incident Status Changed', category: 'Workflow' },
  ALERT_ACKNOWLEDGED: { icon: CircleCheck, bg: 'rgba(79,191,143,0.16)', fg: '#4fbf8f', label: 'Alert Acknowledged', category: 'Workflow' },
  ALERT_STATUS_UPDATED: { icon: ArrowLeftRight, bg: 'rgba(229,118,108,0.16)', fg: '#e5766c', label: 'Alert Status Changed', category: 'Workflow' },

  MESSAGE_POSTED: { icon: MessageCircle, bg: 'rgba(77,208,196,0.16)', fg: '#4dd0c4', label: 'Comment Added', category: 'Comment' },
  ALERT_NOTE_ADDED: { icon: MessageCircle, bg: 'rgba(77,208,196,0.16)', fg: '#4dd0c4', label: 'Alert Note Added', category: 'Comment' },
  ALERT_NOTE_EDITED: { icon: Pencil, bg: 'rgba(77,208,196,0.16)', fg: '#4dd0c4', label: 'Alert Note Edited', category: 'Comment' },
  ALERT_NOTE_DELETED: { icon: Trash2, bg: 'rgba(77,208,196,0.16)', fg: '#4dd0c4', label: 'Alert Note Deleted', category: 'Comment' },

  ALERT_INGESTED: { icon: BellRing, bg: 'rgba(221,154,76,0.16)', fg: '#dd9a4c', label: 'Alert Received', category: 'Alert' },
  ALERT_DISPOSITION_SET: { icon: ClipboardCheck, bg: 'rgba(229,118,108,0.16)', fg: '#e5766c', label: 'Alert Disposition Set', category: 'Alert' },
  ALERT_ASSIGNED: { icon: UserPlus, bg: 'rgba(229,118,108,0.16)', fg: '#e5766c', label: 'Alert Assigned', category: 'Alert' },
  ALERT_UNASSIGNED: { icon: UserMinus, bg: 'rgba(229,118,108,0.16)', fg: '#e5766c', label: 'Alert Unassigned', category: 'Alert' },
  ALERT_PROMOTED: { icon: ArrowUp, bg: 'rgba(229,118,108,0.16)', fg: '#e5766c', label: 'Alert Promoted to Incident', category: 'Alert' },
  ALERT_LINKED: { icon: LinkIcon, bg: 'rgba(229,118,108,0.16)', fg: '#e5766c', label: 'Alert Linked to Incident', category: 'Alert' },
  ALERT_UNLINKED: { icon: Unlink, bg: 'rgba(229,118,108,0.16)', fg: '#e5766c', label: 'Alert Unlinked', category: 'Alert' },

  INCIDENT_CREATED: { icon: BellPlus, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Incident Created', category: 'Incident' },
  INCIDENT_UPDATED: { icon: FileEdit, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Incident Updated', category: 'Incident' },
  INCIDENT_DELETED: { icon: Trash2, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Incident Deleted', category: 'Incident' },
  INCIDENT_ASSIGNED: { icon: UserPlus, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Incident Assigned', category: 'Incident' },
  INCIDENT_UNASSIGNED: { icon: UserMinus, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Incident Unassigned', category: 'Incident' },
  INCIDENT_REPORTER_ASSIGNED: { icon: UserPlus, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Incident Reporter Assigned', category: 'Incident' },
  PRIORITY_UPDATED: { icon: TrendingUp, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Priority Changed', category: 'Incident' },
  // Historical audit entries recorded before the severity->priority rename still carry
  // this action name.
  SEVERITY_UPDATED: { icon: TrendingUp, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Priority Changed', category: 'Incident' },
  INCIDENT_PARTICIPANT_ADDED: { icon: UserRoundPlus, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Participant Added', category: 'Incident' },
  INCIDENT_PARTICIPANT_REMOVED: { icon: UserRoundMinus, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Participant Removed', category: 'Incident' },
  INCIDENT_CONTEXT_UPDATED: { icon: Globe, bg: 'rgba(109,149,224,0.16)', fg: '#6d95e0', label: 'Incident Context Updated', category: 'Incident' },
}

function humanize(action: string): string {
  return action.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()).toLowerCase().replace(/^./, (c) => c.toUpperCase())
}

export function activityType(action: string): ActivityTypeDefinition {
  const known = ACTIVITY_TYPES[action]
  if (known) return { ...known, isUserAction: true, isSystemAction: false }
  return { icon: Circle, bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.55)', label: humanize(action), category: 'System', isUserAction: false, isSystemAction: true }
}

export function activityStyle(action: string): { icon: LucideIcon; bg: string; fg: string } {
  return activityType(action)
}

export function activityTitle(a: AuditRecordResponse): string {
  return activityType(a.action).label
}

/** The state a workflow transition landed on ("Acknowledged", "Investigating", …) —
 *  rendered as a chip next to the row's title rather than buried in the detail line. */
export function activityStateValue(a: AuditRecordResponse): string | null {
  if (a.action !== 'WORKFLOW_TRANSITIONED') return null
  const request = (a.details?.request ?? {}) as Record<string, unknown>
  return typeof request.toState === 'string' ? request.toState : null
}

function EntityRef({ label, color = 'text-primary' }: { label: string; color?: string }) {
  return <span className={`font-semibold ${color}`}>{label}</span>
}

/** The secondary line under each activity's title. Only shows an entity id when it's
 *  actually resolvable from currently-loaded incidents/alerts, and only shows a
 *  before/after value when the backend genuinely captured one in the audit trail —
 *  e.g. alert-unlink doesn't record which incident it came from, so that case just
 *  names the alert rather than fabricating a target. */
export function activityDetail(a: AuditRecordResponse, lookups: ActivityLookups): ReactNode {
  const request = (a.details?.request ?? {}) as Record<string, unknown>
  const details = (a.details ?? {}) as Record<string, unknown>
  const incident = lookups.incidentById.get(a.entityId)
  const alert = lookups.alertById.get(a.entityId)
  const ALERT_COLOR = 'text-emerald-700 dark:text-emerald-400'

  switch (a.action) {
    case 'PRIORITY_UPDATED':
    case 'SEVERITY_UPDATED': {
      // New audit entries carry `request.priority`; entries recorded before the rename
      // still have the old `request.severity` key in their already-stored details blob.
      const priority = (request.priority ?? request.severity) as string | undefined
      return (
        <>
          {incident && (
            <>
              Incident <EntityRef label={incident.displayId} />{' '}
            </>
          )}
          {typeof priority === 'string' && <PriorityBadge priority={priority} size="small" />}
        </>
      )
    }
    case 'WORKFLOW_TRANSITIONED':
      // The resulting state renders as a chip next to the title (see activityStateValue),
      // so this line just names the entity and, when known, what it's about.
      return incident ? (
        <>
          Incident <EntityRef label={incident.displayId} />
          {incident.title ? ` • ${incident.title}` : ''}
        </>
      ) : null
    case 'INCIDENT_CREATED':
      return <>{(request.title as string | undefined) ?? incident?.title ?? ''}</>
    case 'INCIDENT_UPDATED':
      return incident ? (
        <>
          Incident <EntityRef label={incident.displayId} />
        </>
      ) : null
    case 'INCIDENT_ASSIGNED':
      return (
        <>
          {incident && (
            <>
              Incident <EntityRef label={incident.displayId} />
            </>
          )}
          {typeof request.assigneeName === 'string' && <> → {request.assigneeName}</>}
        </>
      )
    case 'INCIDENT_UNASSIGNED':
      return incident ? (
        <>
          Incident <EntityRef label={incident.displayId} />
        </>
      ) : null
    case 'INCIDENT_REPORTER_ASSIGNED':
      return (
        <>
          {incident && (
            <>
              Incident <EntityRef label={incident.displayId} />
            </>
          )}
          {typeof request.reporterName === 'string' && <> → {request.reporterName}</>}
        </>
      )
    case 'INCIDENT_DELETED': {
      const displayId = details.displayId as string | undefined
      const title = details.title as string | undefined
      if (!displayId) return null
      return (
        <>
          Incident <EntityRef label={displayId} />
          {title ? ` — ${title}` : ''}
        </>
      )
    }
    case 'ALERT_INGESTED':
      return alert ? (
        <>
          Alert <EntityRef label={alert.displayId} color={ALERT_COLOR} /> from {alert.source}
        </>
      ) : null
    case 'ALERT_ACKNOWLEDGED':
      return alert ? (
        <>
          Alert <EntityRef label={alert.displayId} color={ALERT_COLOR} />
        </>
      ) : null
    case 'ALERT_STATUS_UPDATED':
      return (
        <>
          {alert && (
            <>
              Alert <EntityRef label={alert.displayId} color={ALERT_COLOR} />
            </>
          )}
          {typeof details.status === 'string' && (
            <>
              {' '}
              → <Badge variant="outline">{details.status as string}</Badge>
            </>
          )}
        </>
      )
    case 'ALERT_ASSIGNED':
      return (
        <>
          {alert && (
            <>
              Alert <EntityRef label={alert.displayId} color={ALERT_COLOR} />
            </>
          )}
          {typeof details.assigneeName === 'string' && <> → {details.assigneeName as string}</>}
        </>
      )
    case 'ALERT_UNASSIGNED':
      return alert ? (
        <>
          Alert <EntityRef label={alert.displayId} color={ALERT_COLOR} />
        </>
      ) : null
    case 'ALERT_PROMOTED': {
      const targetIncident = alert?.incidentId ? lookups.incidentById.get(alert.incidentId) : undefined
      return (
        <>
          {alert && (
            <>
              Alert <EntityRef label={alert.displayId} color={ALERT_COLOR} />
            </>
          )}
          {targetIncident && (
            <>
              {' '}
              → <EntityRef label={targetIncident.displayId} />
            </>
          )}
        </>
      )
    }
    case 'ALERT_LINKED': {
      const incidentId = details.incidentId as string | undefined
      const targetIncident = incidentId ? lookups.incidentById.get(incidentId) : undefined
      return (
        <>
          {alert && (
            <>
              Alert <EntityRef label={alert.displayId} color={ALERT_COLOR} />
            </>
          )}
          {targetIncident && (
            <>
              {' '}
              linked to <EntityRef label={targetIncident.displayId} />
            </>
          )}
        </>
      )
    }
    case 'ALERT_UNLINKED':
      return alert ? (
        <>
          Alert <EntityRef label={alert.displayId} color={ALERT_COLOR} />
        </>
      ) : null
    case 'MESSAGE_POSTED':
      return incident ? (
        <>
          Incident <EntityRef label={incident.displayId} />
        </>
      ) : null
    case 'ALERT_NOTE_ADDED':
    case 'ALERT_NOTE_EDITED':
    case 'ALERT_NOTE_DELETED':
      return alert ? (
        <>
          Alert <EntityRef label={alert.displayId} color={ALERT_COLOR} />
        </>
      ) : null
    default:
      return null
  }
}
