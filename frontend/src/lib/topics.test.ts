import { describe, it, expect } from 'vitest'
import { TOPICS } from './topics'

describe('TOPICS', () => {
  it('contains the expected fixed set of Kafka topic names', () => {
    expect(TOPICS).toEqual([
      'AlertReceived',
      'IncidentCreated',
      'PriorityUpdated',
      'AssignmentChanged',
      'WorkflowTransition',
      'MessageSent',
      'NotificationRequested',
      'MetricsGenerated',
      'AuditEvent',
      'UserRegistered',
      'UserRoleChanged',
    ])
  })

  it('has no duplicate entries', () => {
    expect(new Set(TOPICS).size).toBe(TOPICS.length)
  })
})
