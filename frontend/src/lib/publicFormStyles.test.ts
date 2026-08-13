import { describe, it, expect } from 'vitest'
import { darkFieldClass } from './publicFormStyles'

describe('darkFieldClass', () => {
  it('is a non-empty class string', () => {
    expect(typeof darkFieldClass).toBe('string')
    expect(darkFieldClass.length).toBeGreaterThan(0)
  })

  it('includes the dark surface and marketing-accent focus classes', () => {
    expect(darkFieldClass).toContain('bg-black/50')
    expect(darkFieldClass).toContain('focus-visible:border-marketing-accent')
  })
})
