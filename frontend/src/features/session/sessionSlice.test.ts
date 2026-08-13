import { describe, it, expect, vi, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import sessionReducer, {
  setSession,
  setTokens,
  updateUserRole,
  clearRefreshToken,
  clearSession,
  type SessionState,
  type SessionUser,
} from './sessionSlice'

const user: SessionUser = { id: 'u1', email: 'a@example.com', name: 'Ada', orgId: 'org-1', role: 'ADMIN' }

function makeStore(preloaded?: SessionState) {
  return configureStore({
    reducer: { session: sessionReducer },
    preloadedState: preloaded ? { session: preloaded } : undefined,
  })
}

describe('sessionSlice reducer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('setSession replaces token, refreshToken, and user', () => {
    const store = makeStore()
    store.dispatch(setSession({ token: 'tok', refreshToken: 'refresh', user }))
    expect(store.getState().session).toEqual({ token: 'tok', refreshToken: 'refresh', user })
  })

  it('setSession accepts a null refreshToken', () => {
    const store = makeStore()
    store.dispatch(setSession({ token: 'tok', refreshToken: null, user }))
    expect(store.getState().session.refreshToken).toBeNull()
  })

  it('setTokens rotates token and refreshToken without touching user', () => {
    const store = makeStore({ token: 'old', refreshToken: 'old-refresh', user })
    store.dispatch(setTokens({ token: 'new', refreshToken: 'new-refresh' }))
    const state = store.getState().session
    expect(state.token).toBe('new')
    expect(state.refreshToken).toBe('new-refresh')
    expect(state.user).toBe(user)
  })

  it('updateUserRole updates the role when a user is present', () => {
    const store = makeStore({ token: 't', refreshToken: 'r', user })
    store.dispatch(updateUserRole('VIEWER'))
    expect(store.getState().session.user?.role).toBe('VIEWER')
  })

  it('updateUserRole is a no-op when there is no user', () => {
    const store = makeStore({ token: null, refreshToken: null, user: null })
    store.dispatch(updateUserRole('VIEWER'))
    expect(store.getState().session.user).toBeNull()
  })

  it('clearRefreshToken nulls the refresh token and the user\'s orgId/role, keeps the access token', () => {
    const store = makeStore({ token: 't', refreshToken: 'r', user })
    store.dispatch(clearRefreshToken())
    const state = store.getState().session
    expect(state.token).toBe('t')
    expect(state.refreshToken).toBeNull()
    expect(state.user?.orgId).toBeNull()
    expect(state.user?.role).toBeNull()
    expect(state.user?.id).toBe('u1')
  })

  it('clearRefreshToken is safe when there is no user', () => {
    const store = makeStore({ token: 't', refreshToken: 'r', user: null })
    store.dispatch(clearRefreshToken())
    expect(store.getState().session.user).toBeNull()
    expect(store.getState().session.refreshToken).toBeNull()
  })

  it('clearSession nulls everything', () => {
    const store = makeStore({ token: 't', refreshToken: 'r', user })
    store.dispatch(clearSession())
    expect(store.getState().session).toEqual({ token: null, refreshToken: null, user: null })
  })
})

describe('sessionSlice initial state (localStorage hydration)', () => {
  const originalGetItem = Storage.prototype.getItem

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem
    vi.resetModules()
  })

  it('hydrates from a valid stored session on module load', async () => {
    const stored: SessionState = { token: 'stored-tok', refreshToken: 'stored-refresh', user }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
      key === 'incidentops.session' ? JSON.stringify(stored) : null,
    )
    vi.resetModules()
    const { default: freshReducer } = await import('./sessionSlice')
    const store = configureStore({ reducer: { session: freshReducer } })
    expect(store.getState().session).toEqual(stored)
  })

  it('falls back to a logged-out default when localStorage is empty', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    vi.resetModules()
    const { default: freshReducer } = await import('./sessionSlice')
    const store = configureStore({ reducer: { session: freshReducer } })
    expect(store.getState().session).toEqual({ token: null, refreshToken: null, user: null })
  })

  it('falls back to a logged-out default when localStorage holds corrupt JSON', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{not valid json')
    vi.resetModules()
    const { default: freshReducer } = await import('./sessionSlice')
    const store = configureStore({ reducer: { session: freshReducer } })
    expect(store.getState().session).toEqual({ token: null, refreshToken: null, user: null })
  })

  it('falls back to a logged-out default when localStorage access throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.resetModules()
    const { default: freshReducer } = await import('./sessionSlice')
    const store = configureStore({ reducer: { session: freshReducer } })
    expect(store.getState().session).toEqual({ token: null, refreshToken: null, user: null })
  })
})
