export interface IntegrationsNavItem {
  label: string
  path: string
  icon: 'overview' | 'keys' | 'webhooks' | 'deliveries' | 'apps'
}

export const INTEGRATIONS_OVERVIEW_NAV: IntegrationsNavItem = { label: 'Overview', path: 'overview', icon: 'overview' }

export const INTEGRATIONS_INCOMING_NAV: IntegrationsNavItem[] = [{ label: 'API Keys', path: 'keys', icon: 'keys' }]

/** Order matters: Webhooks → Delivery Logs → Connected Apps, matching how engineers
 *  actually work the debugging path (webhook → its logs → fix), with the more
 *  setup-oriented Connected Apps last. */
export const INTEGRATIONS_OUTGOING_NAV: IntegrationsNavItem[] = [
  { label: 'Webhooks', path: 'webhooks', icon: 'webhooks' },
  { label: 'Delivery Logs', path: 'deliveries', icon: 'deliveries' },
  { label: 'Connected Apps', path: 'apps', icon: 'apps' },
]
