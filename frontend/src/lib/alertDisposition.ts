import type { AlertDisposition } from '@/api/alerts'

export const ALERT_DISPOSITIONS: AlertDisposition[] = [
  'ACTION_REQUIRED',
  'FALSE_POSITIVE',
  'DUPLICATE',
  'SUPPRESSED',
  'AUTO_RECOVERED',
  'TEST',
  'UNKNOWN',
]

export const DISPOSITION_LABELS: Record<AlertDisposition, string> = {
  ACTION_REQUIRED: 'Action Required',
  FALSE_POSITIVE: 'False Positive',
  DUPLICATE: 'Duplicate',
  SUPPRESSED: 'Suppressed',
  AUTO_RECOVERED: 'Auto Recovered',
  TEST: 'Test',
  UNKNOWN: 'Unknown',
}

export const DISPOSITION_COLORS: Record<AlertDisposition, string> = {
  ACTION_REQUIRED: '#e5766c',
  FALSE_POSITIVE: '#dd9a4c',
  DUPLICATE: 'rgba(255,255,255,0.5)',
  SUPPRESSED: '#938ede',
  AUTO_RECOVERED: '#4fbf8f',
  TEST: '#6d95e0',
  UNKNOWN: 'rgba(255,255,255,0.4)',
}
