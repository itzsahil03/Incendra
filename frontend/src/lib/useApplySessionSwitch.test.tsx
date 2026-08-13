import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import sessionReducer from '@/features/session/sessionSlice'
import { useApplySessionSwitch } from './useApplySessionSwitch'
import type { AuthResponse } from '@/api/auth'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function makeWrapper() {
  const store = configureStore({ reducer: { session: sessionReducer } })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const clearSpy = vi.spyOn(queryClient, 'clear')
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      </Provider>
    )
  }
  return { store, queryClient, clearSpy, wrapper }
}

describe('useApplySessionSwitch', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('dispatches setSession, clears the query cache, and navigates to /app', () => {
    const { store, clearSpy, wrapper } = makeWrapper()
    const { result } = renderHook(() => useApplySessionSwitch(), { wrapper })

    const response: AuthResponse = {
      token: 'tok',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'a@example.com', name: 'Ada', orgId: 'org-2', role: 'ADMIN' },
    }

    act(() => {
      result.current(response)
    })

    expect(store.getState().session.token).toBe('tok')
    expect(store.getState().session.user?.orgId).toBe('org-2')
    expect(clearSpy).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true })
  })
})
