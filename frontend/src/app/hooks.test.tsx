import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import { configureStore } from '@reduxjs/toolkit'
import sessionReducer, { setSession } from '@/features/session/sessionSlice'
import uiReducer from '@/features/ui/uiSlice'
import { useAppDispatch, useAppSelector } from './hooks'

function makeWrapper() {
  const store = configureStore({ reducer: { session: sessionReducer, ui: uiReducer } })
  function wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }
  return { store, wrapper }
}

describe('useAppSelector / useAppDispatch', () => {
  it('useAppSelector reads state from the store', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useAppSelector((s) => s.session.token), { wrapper })
    expect(result.current).toBeNull()
  })

  it('useAppDispatch dispatches actions that update state read via useAppSelector', () => {
    const { store, wrapper } = makeWrapper()
    const { result } = renderHook(
      () => ({ dispatch: useAppDispatch(), token: useAppSelector((s) => s.session.token) }),
      { wrapper },
    )
    expect(result.current.token).toBeNull()

    const user = { id: 'u1', email: 'a@example.com', name: 'Ada', orgId: 'org-1', role: 'ADMIN' as const }
    result.current.dispatch(setSession({ token: 'tok', refreshToken: 'r', user }))

    expect(store.getState().session.token).toBe('tok')
  })
})
