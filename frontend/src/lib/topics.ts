/** Mirrors common's events.Topics constants — the real Kafka topic names this backend
 *  publishes, and therefore the only values a webhook subscription can meaningfully
 *  filter on. */
export const TOPICS = [
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
] as const
