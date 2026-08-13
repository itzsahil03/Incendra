import type { LucideIcon } from 'lucide-react'
import { BellRing, Blocks, Flame, Gauge, LineChart, MessageSquare, Ticket, Users } from 'lucide-react'

/** Mirrors common's Provider enum + ProviderMetadata registry — the single frontend
 *  source of truth for provider display info, read by the "Choose Provider" radios
 *  (API Keys/Webhooks create dialogs), Connected Apps, and Overview's "Recent
 *  Integrations" widget instead of switch statements scattered across components. No
 *  real per-brand logo assets are available in this repo, so `color` drives a plain
 *  colored badge rather than a fabricated logo image. */
export const PROVIDERS = ['GENERIC', 'SLACK', 'TEAMS', 'JIRA', 'PAGERDUTY', 'DATADOG', 'GRAFANA', 'PROMETHEUS'] as const
export type Provider = (typeof PROVIDERS)[number]

export type ProviderCategory = 'COMMUNICATION' | 'MONITORING' | 'TICKETING' | 'GENERIC'
export type ProviderTier = 'Official' | 'Custom'

export interface ProviderInfo {
  displayName: string
  color: string
  category: ProviderCategory
  icon: LucideIcon
  supportsWebhook: boolean
  supportsApiKey: boolean
  defaultScopes: string[]
  defaultTopics: string[]
  description: string
  tier: ProviderTier
}

export const PROVIDER_INFO: Record<Provider, ProviderInfo> = {
  GENERIC: {
    displayName: 'Generic',
    color: '#6b7280',
    category: 'GENERIC',
    icon: Blocks,
    supportsWebhook: true,
    supportsApiKey: true,
    defaultScopes: [],
    defaultTopics: [],
    description: 'A custom HTTP endpoint or service account not tied to a named integration.',
    tier: 'Custom',
  },
  SLACK: {
    displayName: 'Slack',
    color: '#4A154B',
    category: 'COMMUNICATION',
    icon: MessageSquare,
    supportsWebhook: true,
    supportsApiKey: false,
    defaultScopes: [],
    defaultTopics: ['IncidentCreated', 'WorkflowTransition', 'AssignmentChanged'],
    description: 'Post incident and alert activity to a Slack channel.',
    tier: 'Official',
  },
  TEAMS: {
    displayName: 'Microsoft Teams',
    color: '#5059C9',
    category: 'COMMUNICATION',
    icon: Users,
    supportsWebhook: true,
    supportsApiKey: false,
    defaultScopes: [],
    defaultTopics: ['IncidentCreated', 'WorkflowTransition'],
    description: 'Post incident and alert activity to a Teams channel.',
    tier: 'Official',
  },
  JIRA: {
    displayName: 'Jira',
    color: '#0052CC',
    category: 'TICKETING',
    icon: Ticket,
    supportsWebhook: true,
    supportsApiKey: false,
    defaultScopes: [],
    defaultTopics: ['IncidentCreated', 'IncidentDeleted'],
    description: 'Create and sync Jira issues from incidents.',
    tier: 'Official',
  },
  PAGERDUTY: {
    displayName: 'PagerDuty',
    color: '#06AC38',
    category: 'MONITORING',
    icon: BellRing,
    supportsWebhook: true,
    supportsApiKey: false,
    defaultScopes: [],
    defaultTopics: ['AlertReceived', 'IncidentCreated'],
    description: 'Escalate alerts and incidents through PagerDuty.',
    tier: 'Official',
  },
  DATADOG: {
    displayName: 'Datadog',
    color: '#632CA6',
    category: 'MONITORING',
    icon: Gauge,
    supportsWebhook: false,
    supportsApiKey: true,
    defaultScopes: ['alerts.write'],
    defaultTopics: [],
    description: 'Ingest monitoring alerts via a scoped API key.',
    tier: 'Official',
  },
  GRAFANA: {
    displayName: 'Grafana',
    color: '#F46800',
    category: 'MONITORING',
    icon: LineChart,
    supportsWebhook: true,
    supportsApiKey: true,
    defaultScopes: ['alerts.write'],
    defaultTopics: ['AlertReceived'],
    description: 'Receive Grafana alert-rule notifications, or ingest via API key.',
    tier: 'Official',
  },
  PROMETHEUS: {
    displayName: 'Prometheus',
    color: '#E6522C',
    category: 'MONITORING',
    icon: Flame,
    supportsWebhook: false,
    supportsApiKey: true,
    defaultScopes: ['alerts.write'],
    defaultTopics: [],
    description: 'Ingest Alertmanager notifications via a scoped API key.',
    tier: 'Official',
  },
}

export function providerInfo(provider: string | null | undefined): ProviderInfo {
  return PROVIDER_INFO[(provider as Provider) ?? 'GENERIC'] ?? PROVIDER_INFO.GENERIC
}
