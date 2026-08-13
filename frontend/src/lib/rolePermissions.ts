import type { Role } from '@/features/session/sessionSlice'

export interface RolePermissionItem {
  label: string
  allowed: boolean
}

export interface RolePermissionGroup {
  resource: string
  items: RolePermissionItem[]
}

export interface RoleDefinition {
  role: Role
  label: string
  description: string
  groups: RolePermissionGroup[]
}

/** Mirrors the actual <RoleGate allow={[...]}> / <ProtectedRoute allowedRoles={[...]}>
 *  checks scattered across the app (incidents, alerts, settings, integrations) — kept in
 *  sync by hand since there's no single server-side permission registry for human roles
 *  (unlike API-key scopes, see lib/scopes.ts). If a RoleGate changes, update here too. */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: 'ADMIN',
    label: 'Admin',
    description: 'Full access to the organization — incident response, member management, and integrations.',
    groups: [
      {
        resource: 'Incidents',
        items: [
          { label: 'View incidents', allowed: true },
          { label: 'Create incidents', allowed: true },
          { label: 'Update incident status', allowed: true },
          { label: 'Edit incident details', allowed: true },
          { label: 'Manage participants', allowed: true },
        ],
      },
      {
        resource: 'Alerts',
        items: [
          { label: 'View alerts', allowed: true },
          { label: 'Acknowledge & link alerts', allowed: true },
        ],
      },
      {
        resource: 'Analytics & Audit Log',
        items: [
          { label: 'View analytics', allowed: true },
          { label: 'View audit log', allowed: true },
        ],
      },
      {
        resource: 'Members & Roles',
        items: [
          { label: 'View members', allowed: true },
          { label: 'Invite members', allowed: true },
          { label: 'Remove members', allowed: true },
          { label: 'Change member roles', allowed: true },
          { label: 'Manage roles & permissions', allowed: true },
        ],
      },
      {
        resource: 'Integrations',
        items: [
          { label: 'Manage API keys', allowed: true },
          { label: 'Manage webhooks', allowed: true },
        ],
      },
      {
        resource: 'Organization Settings',
        items: [{ label: 'Edit organization profile', allowed: true }],
      },
    ],
  },
  {
    role: 'RESPONDER',
    label: 'Responder',
    description: 'Handles day-to-day incident response without access to org administration.',
    groups: [
      {
        resource: 'Incidents',
        items: [
          { label: 'View incidents', allowed: true },
          { label: 'Create incidents', allowed: true },
          { label: 'Update incident status', allowed: true },
          { label: 'Edit incident details', allowed: true },
          { label: 'Manage participants', allowed: true },
        ],
      },
      {
        resource: 'Alerts',
        items: [
          { label: 'View alerts', allowed: true },
          { label: 'Acknowledge & link alerts', allowed: true },
        ],
      },
      {
        resource: 'Analytics & Audit Log',
        items: [
          { label: 'View analytics', allowed: true },
          { label: 'View audit log', allowed: true },
        ],
      },
      {
        resource: 'Members & Roles',
        items: [
          { label: 'View members', allowed: true },
          { label: 'Invite members', allowed: false },
          { label: 'Remove members', allowed: false },
          { label: 'Change member roles', allowed: false },
          { label: 'Manage roles & permissions', allowed: false },
        ],
      },
      {
        resource: 'Integrations',
        items: [
          { label: 'Manage API keys', allowed: false },
          { label: 'Manage webhooks', allowed: false },
        ],
      },
      {
        resource: 'Organization Settings',
        items: [{ label: 'Edit organization profile', allowed: false }],
      },
    ],
  },
  {
    role: 'VIEWER',
    label: 'Viewer',
    description: 'Read-only access — can follow incidents and alerts without making changes.',
    groups: [
      {
        resource: 'Incidents',
        items: [
          { label: 'View incidents', allowed: true },
          { label: 'Create incidents', allowed: false },
          { label: 'Update incident status', allowed: false },
          { label: 'Edit incident details', allowed: false },
          { label: 'Manage participants', allowed: false },
        ],
      },
      {
        resource: 'Alerts',
        items: [
          { label: 'View alerts', allowed: true },
          { label: 'Acknowledge & link alerts', allowed: false },
        ],
      },
      {
        resource: 'Analytics & Audit Log',
        items: [
          { label: 'View analytics', allowed: true },
          { label: 'View audit log', allowed: true },
        ],
      },
      {
        resource: 'Members & Roles',
        items: [
          { label: 'View members', allowed: true },
          { label: 'Invite members', allowed: false },
          { label: 'Remove members', allowed: false },
          { label: 'Change member roles', allowed: false },
          { label: 'Manage roles & permissions', allowed: false },
        ],
      },
      {
        resource: 'Integrations',
        items: [
          { label: 'Manage API keys', allowed: false },
          { label: 'Manage webhooks', allowed: false },
        ],
      },
      {
        resource: 'Organization Settings',
        items: [{ label: 'Edit organization profile', allowed: false }],
      },
    ],
  },
]
