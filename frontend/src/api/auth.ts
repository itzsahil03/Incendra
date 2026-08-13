import { apiClient } from './client'
import type { Role, SessionUser } from '@/features/session/sessionSlice'

export interface AuthResponse {
  token: string
  refreshToken: string | null
  user: SessionUser
}

/** `orgName` is required unless `inviteToken` is present — a fresh, org-less
 *  registration (RegisterPage → WelcomePage) only ever calls this once, from
 *  WelcomePage's "Create your organization" submit, so the account is created together
 *  with a real, named org in one atomic step. There is no "register now, name an org
 *  later" call shape. */
export function register(body: { email: string; name: string; password: string; inviteToken?: string; orgName?: string }) {
  return apiClient.post<AuthResponse>('/api/auth/register', body).then((r) => r.data)
}

export function login(body: { email: string; password: string }) {
  return apiClient.post<AuthResponse>('/api/auth/login', body).then((r) => r.data)
}

export function logout(refreshToken: string) {
  return apiClient.post('/api/auth/logout', { refreshToken })
}

export function forgotPassword(email: string) {
  return apiClient.post('/api/auth/forgot-password', { email })
}

export function resetPassword(body: { token: string; newPassword: string }) {
  return apiClient.post('/api/auth/reset-password', body)
}

export function changePassword(body: { currentPassword: string; newPassword: string }) {
  return apiClient.post('/api/auth/change-password', body)
}

/** Permanently deletes the caller's own account — every org's membership, every
 *  refresh token, and the account itself. Requires the current password as a re-auth
 *  step. Rejected (409) if the caller is the sole admin of any org they belong to. */
export function deleteAccount(password: string) {
  return apiClient.delete('/api/auth/me', { data: { password } })
}

export interface UserAccountResponse {
  id: string
  email: string
  name: string
  role: Role
  createdAt: string
}

export function listAccounts() {
  return apiClient.get<UserAccountResponse[]>('/api/auth/users').then((r) => r.data)
}

export function updateAccountRole(id: string, role: Role) {
  return apiClient.put<UserAccountResponse>(`/api/auth/users/${id}/role`, { role }).then((r) => r.data)
}

/** Admin-initiated removal from the caller's own org — removes only the target's
 *  Membership, not their UserAccount or any other org's membership. */
export function removeMember(id: string) {
  return apiClient.delete(`/api/auth/users/${id}`)
}

export type ClientStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'REVOKED' | 'EXPIRED'

export interface ClientResponse {
  clientId: string
  name: string
  provider: string
  orgId: string
  scopes: string[]
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  requestsToday: number
  requestCountTotal: number
  status: ClientStatus
}

export interface ClientSecretResponse {
  clientId: string
  clientSecret: string
  rotatedAt: string
}

export interface CreateClientRequest {
  clientId: string
  name: string
  provider: string
  scopes: string[]
  expiresAt?: string | null
}

export function listClients() {
  return apiClient.get<ClientResponse[]>('/api/auth/clients').then((r) => r.data)
}

export function getClient(clientId: string) {
  return apiClient.get<ClientResponse>(`/api/auth/clients/${clientId}`).then((r) => r.data)
}

export function recentClientUsage(limit = 5) {
  return apiClient.get<ClientResponse[]>('/api/auth/clients/recent-usage', { params: { limit } }).then((r) => r.data)
}

export function createClient(body: CreateClientRequest) {
  return apiClient.post<ClientSecretResponse>('/api/auth/clients', body).then((r) => r.data)
}

export function rotateClient(clientId: string) {
  return apiClient.post<ClientSecretResponse>(`/api/auth/clients/${clientId}/rotate`).then((r) => r.data)
}

export function deleteClient(clientId: string) {
  return apiClient.delete(`/api/auth/clients/${clientId}`)
}

export interface InvitationResponse {
  id: string
  email: string
  role: Role
  invitedByUserId: string
  createdAt: string
  expiresAt: string
}

export interface InvitationPreviewResponse {
  email: string
  orgId: string
  orgName: string
  role: Role
  invitedByName: string
  expiresAt: string
  hasExistingAccount: boolean
}

export function listInvitations() {
  return apiClient.get<InvitationResponse[]>('/api/auth/invitations').then((r) => r.data)
}

export function createInvitation(body: { email: string; role: Role }) {
  return apiClient.post<InvitationResponse>('/api/auth/invitations', body).then((r) => r.data)
}

export function revokeInvitation(id: string) {
  return apiClient.delete(`/api/auth/invitations/${id}`)
}

/** Public — no Authorization header needed, same as the register/login calls above. */
export function verifyInvitation(token: string) {
  return apiClient.get<InvitationPreviewResponse>('/api/auth/invitations/verify', { params: { token } }).then((r) => r.data)
}

/** Authenticated accept — for an existing logged-in user opening someone else's invite
 *  link. Requires the caller's own current refresh token (see Backend item 7); rotates
 *  the session to the newly-joined org on success. */
export function acceptInvitation(token: string, refreshToken: string) {
  return apiClient.post<AuthResponse>(`/api/auth/invitations/${token}/accept`, { refreshToken }).then((r) => r.data)
}

export interface MembershipResponse {
  orgId: string
  orgName: string
  role: Role
}

/** The topbar org switcher's data source — one entry per ACTIVE membership. */
export function listMyOrgs() {
  return apiClient.get<MembershipResponse[]>('/api/auth/my-orgs').then((r) => r.data)
}

/** Requires the caller's current refresh token (see Backend item 8) — the backend
 *  rejects a switch without it. Rotates the session to the target org on success. */
export function switchOrg(orgId: string, refreshToken: string) {
  return apiClient.post<AuthResponse>('/api/auth/switch-org', { orgId, refreshToken }).then((r) => r.data)
}

/** Creates an additional, named organization for an existing user (switcher "+ Create
 *  organization"), or bootstraps the first one for a caller with zero ACTIVE
 *  memberships — `refreshToken` is required in the former case, omitted in the latter
 *  (see Backend item 4's two-branch security model). Provisions and names the org
 *  atomically in one call — no separate orgApi.createOrg follow-up needed. */
export function createOrgMembership(orgName: string, refreshToken?: string) {
  return apiClient.post<AuthResponse>('/api/auth/orgs', { refreshToken, orgName }).then((r) => r.data)
}

export interface LeaveOrganizationResponse {
  accountDeleted: boolean
  hasRemainingOrg: boolean
  session: AuthResponse | null
}

/** Self-service — only valid for the caller's currently-active org. See
 *  sessionSlice's clearRefreshToken for how the frontend must handle the
 *  hasRemainingOrg: false case. */
export function leaveOrganization(orgId: string, refreshToken: string) {
  return apiClient
    .delete<LeaveOrganizationResponse>(`/api/auth/memberships/${orgId}`, { data: { refreshToken } })
    .then((r) => r.data)
}

export interface OrgSummaryResponse {
  orgId: string
  memberCount: number
  adminCount: number
}

export function getOrgSummary() {
  return apiClient.get<OrgSummaryResponse>('/api/auth/org-summary').then((r) => r.data)
}

export interface DeleteOrganizationResponse {
  accountDeleted: boolean
  hasRemainingOrg: boolean
  session: AuthResponse | null
}

/** Only the org's sole ACTIVE admin may call this — permanently deletes the entire
 *  organization (every member's membership, and org-scoped data across every service),
 *  and deletes outright the account of any member left with zero ACTIVE memberships
 *  anywhere, possibly including the caller. Requires the caller's current password, same
 *  re-auth bar as deleteAccount. */
export function deleteOrganization(password: string) {
  return apiClient.delete<DeleteOrganizationResponse>('/api/auth/org', { data: { password } }).then((r) => r.data)
}
