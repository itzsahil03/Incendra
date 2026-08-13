import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { activityType, activityStyle, activityTitle, activityStateValue, activityDetail, CATEGORY_BADGE_COLOR, type ActivityLookups } from './activity'
import type { AuditRecordResponse } from '@/api/audit'
import type { IncidentResponse } from '@/api/incidents'
import type { AlertResponse } from '@/api/alerts'

function record(overrides: Partial<AuditRecordResponse> = {}): AuditRecordResponse {
  return {
    auditId: 'a1',
    orgId: 'org-1',
    service: 'incident-service',
    action: 'INCIDENT_CREATED',
    entityType: 'Incident',
    entityId: 'inc-1',
    actorId: 'u1',
    occurredAt: '2026-01-01T00:00:00Z',
    details: {},
    ...overrides,
  }
}

function incident(overrides: Partial<IncidentResponse> = {}): IncidentResponse {
  return {
    id: 'inc-1',
    displayId: 'INC-1',
    orgId: 'org-1',
    title: 'DB down',
    description: '',
    priority: 'P1',
    status: 'OPEN',
    assigneeId: null,
    assigneeName: null,
    reporterId: null,
    reporterName: null,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
    resolvedAt: null,
    environment: null,
    ...overrides,
  } as IncidentResponse
}

function alert(overrides: Partial<AlertResponse> = {}): AlertResponse {
  return {
    id: 'a-1',
    displayId: 'ALT-1',
    orgId: 'org-1',
    source: 'datadog',
    title: 'High CPU',
    description: '',
    priority: 'P2',
    receivedAt: '2026-01-01T00:00:00Z',
    raw: {},
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    status: 'OPEN',
    assigneeId: null,
    assigneeName: null,
    ...overrides,
  } as AlertResponse
}

function lookups(overrides: Partial<ActivityLookups> = {}): ActivityLookups {
  return {
    incidentById: new Map(),
    alertById: new Map(),
    nameById: new Map(),
    incidentIdByDisplayId: new Map(),
    alertIdByDisplayId: new Map(),
    ...overrides,
  }
}

function renderDetail(a: AuditRecordResponse, l: ActivityLookups = lookups()): string {
  const { container } = render(<>{activityDetail(a, l)}</>)
  return container.textContent ?? ''
}

describe('activityType', () => {
  it('returns the known definition for a recognized action, marked as a user action', () => {
    const t = activityType('INCIDENT_CREATED')
    expect(t.label).toBe('Incident Created')
    expect(t.category).toBe('Incident')
    expect(t.isUserAction).toBe(true)
    expect(t.isSystemAction).toBe(false)
  })

  it('falls back to a humanized label under System for an unknown action', () => {
    const t = activityType('SOME_WEIRD_ACTION')
    expect(t.label).toBe('Some weird action')
    expect(t.category).toBe('System')
    expect(t.isUserAction).toBe(false)
    expect(t.isSystemAction).toBe(true)
  })

  it('maps every documented action to a label and category without throwing', () => {
    const actions = [
      'WORKFLOW_TRANSITIONED', 'ALERT_ACKNOWLEDGED', 'ALERT_STATUS_UPDATED', 'MESSAGE_POSTED',
      'ALERT_NOTE_ADDED', 'ALERT_NOTE_EDITED', 'ALERT_NOTE_DELETED', 'ALERT_INGESTED',
      'ALERT_DISPOSITION_SET', 'ALERT_ASSIGNED', 'ALERT_UNASSIGNED', 'ALERT_PROMOTED',
      'ALERT_LINKED', 'ALERT_UNLINKED', 'INCIDENT_CREATED', 'INCIDENT_UPDATED',
      'INCIDENT_DELETED', 'INCIDENT_ASSIGNED', 'INCIDENT_UNASSIGNED', 'INCIDENT_REPORTER_ASSIGNED',
      'PRIORITY_UPDATED', 'SEVERITY_UPDATED', 'INCIDENT_PARTICIPANT_ADDED', 'INCIDENT_PARTICIPANT_REMOVED',
      'INCIDENT_CONTEXT_UPDATED',
    ]
    for (const action of actions) {
      const t = activityType(action)
      expect(t.label).toBeTruthy()
      expect(t.category).toBeTruthy()
    }
  })

  it('groups PRIORITY_UPDATED and its legacy SEVERITY_UPDATED alias under the same label', () => {
    expect(activityType('PRIORITY_UPDATED').label).toBe(activityType('SEVERITY_UPDATED').label)
  })
})

describe('activityStyle', () => {
  it('is an alias for activityType', () => {
    expect(activityStyle('INCIDENT_CREATED')).toEqual(activityType('INCIDENT_CREATED'))
  })
})

describe('activityTitle', () => {
  it('returns the label for the record’s action', () => {
    expect(activityTitle(record({ action: 'ALERT_ACKNOWLEDGED' }))).toBe('Alert Acknowledged')
  })
})

describe('activityStateValue', () => {
  it('returns the toState for a workflow transition', () => {
    const a = record({ action: 'WORKFLOW_TRANSITIONED', details: { request: { toState: 'Acknowledged' } } })
    expect(activityStateValue(a)).toBe('Acknowledged')
  })

  it('returns null for a non-transition action', () => {
    expect(activityStateValue(record({ action: 'INCIDENT_CREATED' }))).toBeNull()
  })

  it('returns null when toState is missing or not a string', () => {
    expect(activityStateValue(record({ action: 'WORKFLOW_TRANSITIONED', details: {} }))).toBeNull()
    expect(activityStateValue(record({ action: 'WORKFLOW_TRANSITIONED', details: { request: { toState: 5 } } }))).toBeNull()
  })
})

describe('CATEGORY_BADGE_COLOR', () => {
  it('has a color for every category', () => {
    expect(Object.keys(CATEGORY_BADGE_COLOR).sort()).toEqual(['Alert', 'Comment', 'Incident', 'System', 'Workflow'].sort())
  })
})

describe('activityDetail', () => {
  it('PRIORITY_UPDATED: shows the incident id and priority badge when both resolve', () => {
    const inc = incident()
    const text = renderDetail(
      record({ action: 'PRIORITY_UPDATED', entityId: 'inc-1', details: { request: { priority: 'P1' } } }),
      lookups({ incidentById: new Map([['inc-1', inc]]) }),
    )
    expect(text).toContain('INC-1')
    expect(text).toContain('P1')
  })

  it('SEVERITY_UPDATED: falls back to the legacy request.severity key', () => {
    const text = renderDetail(record({ action: 'SEVERITY_UPDATED', details: { request: { severity: 'P2' } } }))
    expect(text).toContain('P2')
  })

  it('WORKFLOW_TRANSITIONED: shows incident id and title when resolvable', () => {
    const inc = incident({ title: 'DB down' })
    const text = renderDetail(record({ action: 'WORKFLOW_TRANSITIONED', entityId: 'inc-1' }), lookups({ incidentById: new Map([['inc-1', inc]]) }))
    expect(text).toContain('INC-1')
    expect(text).toContain('DB down')
  })

  it('WORKFLOW_TRANSITIONED: renders nothing when the incident does not resolve', () => {
    expect(renderDetail(record({ action: 'WORKFLOW_TRANSITIONED', entityId: 'unknown' }))).toBe('')
  })

  it('INCIDENT_CREATED: prefers request.title, falling back to the resolved incident title', () => {
    expect(renderDetail(record({ action: 'INCIDENT_CREATED', details: { request: { title: 'New incident' } } }))).toBe('New incident')
    const inc = incident({ title: 'Fallback title' })
    expect(
      renderDetail(record({ action: 'INCIDENT_CREATED', entityId: 'inc-1', details: {} }), lookups({ incidentById: new Map([['inc-1', inc]]) })),
    ).toBe('Fallback title')
  })

  it('INCIDENT_UPDATED / INCIDENT_UNASSIGNED / MESSAGE_POSTED: show the incident id when resolvable', () => {
    const inc = incident()
    const l = lookups({ incidentById: new Map([['inc-1', inc]]) })
    for (const action of ['INCIDENT_UPDATED', 'INCIDENT_UNASSIGNED', 'MESSAGE_POSTED']) {
      expect(renderDetail(record({ action, entityId: 'inc-1' }), l)).toContain('INC-1')
      expect(renderDetail(record({ action, entityId: 'unknown' }))).toBe('')
    }
  })

  it('INCIDENT_ASSIGNED: shows incident id and assignee name arrow', () => {
    const inc = incident()
    const text = renderDetail(
      record({ action: 'INCIDENT_ASSIGNED', entityId: 'inc-1', details: { request: { assigneeName: 'Bob' } } }),
      lookups({ incidentById: new Map([['inc-1', inc]]) }),
    )
    expect(text).toContain('INC-1')
    expect(text).toContain('Bob')
  })

  it('INCIDENT_REPORTER_ASSIGNED: shows incident id and reporter name arrow', () => {
    const inc = incident()
    const text = renderDetail(
      record({ action: 'INCIDENT_REPORTER_ASSIGNED', entityId: 'inc-1', details: { request: { reporterName: 'Carol' } } }),
      lookups({ incidentById: new Map([['inc-1', inc]]) }),
    )
    expect(text).toContain('INC-1')
    expect(text).toContain('Carol')
  })

  it('INCIDENT_DELETED: uses displayId/title captured directly in details, returns null without a displayId', () => {
    expect(renderDetail(record({ action: 'INCIDENT_DELETED', details: { displayId: 'INC-9', title: 'Gone' } }))).toContain('INC-9')
    expect(renderDetail(record({ action: 'INCIDENT_DELETED', details: { displayId: 'INC-9', title: 'Gone' } }))).toContain('Gone')
    expect(renderDetail(record({ action: 'INCIDENT_DELETED', details: {} }))).toBe('')
  })

  it('ALERT_INGESTED: shows the alert id and source', () => {
    const al = alert({ source: 'datadog' })
    const text = renderDetail(record({ action: 'ALERT_INGESTED', entityId: 'a-1' }), lookups({ alertById: new Map([['a-1', al]]) }))
    expect(text).toContain('ALT-1')
    expect(text).toContain('datadog')
  })

  it('ALERT_ACKNOWLEDGED / ALERT_UNASSIGNED / ALERT_NOTE_*: show alert id when resolvable, null otherwise', () => {
    const al = alert()
    const l = lookups({ alertById: new Map([['a-1', al]]) })
    for (const action of ['ALERT_ACKNOWLEDGED', 'ALERT_UNASSIGNED', 'ALERT_NOTE_ADDED', 'ALERT_NOTE_EDITED', 'ALERT_NOTE_DELETED', 'ALERT_UNLINKED']) {
      expect(renderDetail(record({ action, entityId: 'a-1' }), l)).toContain('ALT-1')
      expect(renderDetail(record({ action, entityId: 'unknown' }))).toBe('')
    }
  })

  it('ALERT_STATUS_UPDATED: shows alert id and the new status badge', () => {
    const al = alert()
    const text = renderDetail(
      record({ action: 'ALERT_STATUS_UPDATED', entityId: 'a-1', details: { status: 'RESOLVED' } }),
      lookups({ alertById: new Map([['a-1', al]]) }),
    )
    expect(text).toContain('ALT-1')
    expect(text).toContain('RESOLVED')
  })

  it('ALERT_ASSIGNED: shows alert id and assignee name from details', () => {
    const al = alert()
    const text = renderDetail(
      record({ action: 'ALERT_ASSIGNED', entityId: 'a-1', details: { assigneeName: 'Dave' } }),
      lookups({ alertById: new Map([['a-1', al]]) }),
    )
    expect(text).toContain('ALT-1')
    expect(text).toContain('Dave')
  })

  it('ALERT_PROMOTED: shows the alert and the target incident it was promoted into', () => {
    const al = alert({ incidentId: 'inc-1' } as Partial<AlertResponse>)
    const inc = incident()
    const text = renderDetail(
      record({ action: 'ALERT_PROMOTED', entityId: 'a-1' }),
      lookups({ alertById: new Map([['a-1', al]]), incidentById: new Map([['inc-1', inc]]) }),
    )
    expect(text).toContain('ALT-1')
    expect(text).toContain('INC-1')
  })

  it('ALERT_PROMOTED: shows just the alert when there is no incidentId on it', () => {
    const al = alert()
    const text = renderDetail(record({ action: 'ALERT_PROMOTED', entityId: 'a-1' }), lookups({ alertById: new Map([['a-1', al]]) }))
    expect(text).toBe('Alert ALT-1')
  })

  it('ALERT_LINKED: shows the alert and the incident named in details.incidentId', () => {
    const al = alert()
    const inc = incident()
    const text = renderDetail(
      record({ action: 'ALERT_LINKED', entityId: 'a-1', details: { incidentId: 'inc-1' } }),
      lookups({ alertById: new Map([['a-1', al]]), incidentById: new Map([['inc-1', inc]]) }),
    )
    expect(text).toContain('ALT-1')
    expect(text).toContain('linked to')
    expect(text).toContain('INC-1')
  })

  it('returns null for an unmapped action', () => {
    expect(renderDetail(record({ action: 'SOME_WEIRD_ACTION' }))).toBe('')
  })
})
