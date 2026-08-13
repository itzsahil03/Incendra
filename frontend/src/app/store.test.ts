import { describe, it, expect, vi, afterEach } from 'vitest'
import { store } from './store'
import { setThemeModeManual } from '@/features/ui/uiSlice'
import { setSession } from '@/features/session/sessionSlice'

describe('store', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('combines the session and ui reducers', () => {
    const state = store.getState()
    expect(state).toHaveProperty('session')
    expect(state).toHaveProperty('ui')
  })

  it('persists session and ui state to localStorage on every dispatch', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    store.dispatch(setThemeModeManual('dark'))

    expect(setItemSpy).toHaveBeenCalledWith('incidentops.session', JSON.stringify(store.getState().session))
    expect(setItemSpy).toHaveBeenCalledWith('incidentops.ui', JSON.stringify(store.getState().ui))
  })

  it('persists an updated session after setSession', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const user = { id: 'u1', email: 'a@example.com', name: 'Ada', orgId: 'org-1', role: 'ADMIN' as const }

    store.dispatch(setSession({ token: 'tok', refreshToken: 'refresh', user }))

    expect(setItemSpy).toHaveBeenCalledWith(
      'incidentops.session',
      JSON.stringify({ token: 'tok', refreshToken: 'refresh', user }),
    )
  })
})
