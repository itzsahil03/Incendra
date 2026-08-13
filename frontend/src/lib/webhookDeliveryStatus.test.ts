import { describe, it, expect } from 'vitest'
import { DELIVERY_OUTCOME_LABEL, DELIVERY_OUTCOME_COLOR, WEBHOOK_HEALTH_COLOR } from './webhookDeliveryStatus'

describe('webhookDeliveryStatus', () => {
  it('has a label and color for every delivery outcome', () => {
    const outcomes = ['DELIVERED', 'RETRYING', 'FAILED'] as const
    for (const o of outcomes) {
      expect(DELIVERY_OUTCOME_LABEL[o]).toBeTruthy()
      expect(DELIVERY_OUTCOME_COLOR[o]).toBeTruthy()
    }
  })

  it('has a color for every health status', () => {
    expect(WEBHOOK_HEALTH_COLOR.Healthy).toBeTruthy()
    expect(WEBHOOK_HEALTH_COLOR.Degraded).toBeTruthy()
    expect(WEBHOOK_HEALTH_COLOR.NoData).toBeTruthy()
  })
})
