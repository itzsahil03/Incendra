import { describe, it, expect } from 'vitest'
import { queryClient } from './queryClient'

describe('queryClient', () => {
  it('is configured with the expected default query options', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.staleTime).toBe(30_000)
    expect(defaults.queries?.retry).toBe(1)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
  })
})
