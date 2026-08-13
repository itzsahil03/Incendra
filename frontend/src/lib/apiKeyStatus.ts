import type { ClientStatus } from '@/api/auth'

export const API_KEY_STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: 'Active',
  EXPIRING_SOON: 'Expiring Soon',
  REVOKED: 'Revoked',
  EXPIRED: 'Expired',
}

export const API_KEY_STATUS_COLOR: Record<ClientStatus, string> = {
  ACTIVE: '#4fbf8f',
  EXPIRING_SOON: '#dd9a4c',
  REVOKED: 'rgba(255,255,255,0.4)',
  EXPIRED: '#e5766c',
}
