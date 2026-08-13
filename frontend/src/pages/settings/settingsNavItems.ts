import type { Role } from '@/features/session/sessionSlice'

export interface SettingsNavItem {
  label: string
  path: string
  icon: 'general' | 'members' | 'invitations' | 'roles' | 'audit' | 'profile' | 'password'
  allow?: Role[]
}

/** API Keys moved to the top-level Integrations section (see pages/integrations/) —
 *  it'd outgrown a Settings tab once it needed scopes, usage stats, and a detail drawer. */
export const ORG_SETTINGS_NAV: SettingsNavItem[] = [
  { label: 'General', path: 'general', icon: 'general' },
  { label: 'Members', path: 'members', icon: 'members' },
  { label: 'Invitations', path: 'invitations', icon: 'invitations' },
  { label: 'Roles & Permissions', path: 'roles', icon: 'roles', allow: ['ADMIN'] },
  { label: 'Audit Log', path: 'audit-log', icon: 'audit' },
]

export const ACCOUNT_SETTINGS_NAV: SettingsNavItem[] = [
  { label: 'Profile', path: 'profile', icon: 'profile' },
  { label: 'Change Password', path: 'password', icon: 'password' },
]
