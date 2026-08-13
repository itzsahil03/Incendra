import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAccountLabels } from './useAccountLabels'

describe('useAccountLabels', () => {
  it('returns undecorated names when there are no collisions', () => {
    const accounts = [
      { id: '1', name: 'Ada', email: 'ada@example.com' },
      { id: '2', name: 'Grace', email: 'grace@example.com' },
    ]
    const { result } = renderHook(() => useAccountLabels(accounts))
    expect(result.current.get('1')).toBe('Ada')
    expect(result.current.get('2')).toBe('Grace')
  })

  it('disambiguates accounts that share a display name by appending the email', () => {
    const accounts = [
      { id: '1', name: 'Ada', email: 'ada1@example.com' },
      { id: '2', name: 'Ada', email: 'ada2@example.com' },
      { id: '3', name: 'Ada', email: 'ada3@example.com' },
      { id: '4', name: 'Grace', email: 'grace@example.com' },
    ]
    const { result } = renderHook(() => useAccountLabels(accounts))
    expect(result.current.get('1')).toBe('Ada (ada1@example.com)')
    expect(result.current.get('2')).toBe('Ada (ada2@example.com)')
    expect(result.current.get('3')).toBe('Ada (ada3@example.com)')
    expect(result.current.get('4')).toBe('Grace')
  })

  it('returns an empty map for undefined input', () => {
    const { result } = renderHook(() => useAccountLabels(undefined))
    expect(result.current.size).toBe(0)
  })

  it('returns an empty map for an empty array', () => {
    const { result } = renderHook(() => useAccountLabels([]))
    expect(result.current.size).toBe(0)
  })

  it('recomputes when the accounts array changes', () => {
    const { result, rerender } = renderHook(({ accounts }) => useAccountLabels(accounts), {
      initialProps: { accounts: [{ id: '1', name: 'Ada', email: 'a@example.com' }] as { id: string; name: string; email: string }[] | undefined },
    })
    expect(result.current.get('1')).toBe('Ada')

    rerender({ accounts: [{ id: '1', name: 'Ada', email: 'a@example.com' }, { id: '2', name: 'Ada', email: 'b@example.com' }] })
    expect(result.current.get('1')).toBe('Ada (a@example.com)')
    expect(result.current.get('2')).toBe('Ada (b@example.com)')
  })
})
