/** Mirrors common's Scope constants — flat `resource.action` strings, not one constant
 *  per resource/action pair, so a new resource is one line here too. */
export const SCOPES = [
  'alerts.read',
  'alerts.write',
  'incidents.read',
  'incidents.write',
  'analytics.read',
  'notifications.write',
  'webhooks.read',
  'webhooks.write',
] as const

export type Scope = (typeof SCOPES)[number]

export interface ScopePreset {
  label: string
  scopes: Scope[]
}

/** 90% of users won't hand-build a scope combination — a preset pre-checks the
 *  resource-grouped list below it; picking "Custom" (or manually toggling any box)
 *  breaks out of the preset. */
export const SCOPE_PRESETS: ScopePreset[] = [
  { label: 'Monitoring', scopes: ['alerts.read', 'alerts.write'] },
  { label: 'Incident Automation', scopes: ['incidents.read', 'incidents.write'] },
  { label: 'Analytics', scopes: ['analytics.read'] },
  { label: 'Read Only', scopes: SCOPES.filter((s) => s.endsWith('.read')) as Scope[] },
  { label: 'Administrator', scopes: [...SCOPES] },
]

/** { alerts: ['read','write'], incidents: ['read'] } — used to render scopes grouped
 *  by resource (e.g. "Alerts: Read, Write") instead of a flat badge list. */
export function groupScopesByResource(scopes: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  for (const scope of scopes) {
    const [resource, action] = scope.split('.')
    if (!resource || !action) continue
    grouped[resource] ??= []
    grouped[resource].push(action)
  }
  return grouped
}

export function matchingPresetLabel(scopes: string[]): string {
  const sorted = [...scopes].sort().join(',')
  const preset = SCOPE_PRESETS.find((p) => [...p.scopes].sort().join(',') === sorted)
  return preset?.label ?? 'Custom'
}

export function capitalize(s: string) {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}
