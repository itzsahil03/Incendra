import type { DeliveryOutcome } from '@/api/webhookDeliveries'

export const DELIVERY_OUTCOME_LABEL: Record<DeliveryOutcome, string> = {
  DELIVERED: 'Delivered',
  RETRYING: 'Retrying',
  FAILED: 'Failed',
}

export const DELIVERY_OUTCOME_COLOR: Record<DeliveryOutcome, string> = {
  DELIVERED: '#4fbf8f',
  RETRYING: '#dd9a4c',
  FAILED: '#e5766c',
}

export const WEBHOOK_HEALTH_COLOR: Record<string, string> = {
  Healthy: '#4fbf8f',
  Degraded: '#e5766c',
  NoData: 'rgba(255,255,255,0.4)',
}
