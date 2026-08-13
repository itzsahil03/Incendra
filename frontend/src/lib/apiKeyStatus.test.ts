import { describe, it, expect } from 'vitest'
import { API_KEY_STATUS_LABEL, API_KEY_STATUS_COLOR } from './apiKeyStatus'

describe('apiKeyStatus', () => {
  it('has a label and color for every client status', () => {
    const statuses = ['ACTIVE', 'EXPIRING_SOON', 'REVOKED', 'EXPIRED'] as const
    for (const s of statuses) {
      expect(API_KEY_STATUS_LABEL[s]).toBeTruthy()
      expect(API_KEY_STATUS_COLOR[s]).toBeTruthy()
    }
  })

  it('labels are human readable, not raw enum values', () => {
    expect(API_KEY_STATUS_LABEL.EXPIRING_SOON).toBe('Expiring Soon')
  })
})
