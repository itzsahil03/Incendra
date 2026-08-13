import { describe, it, expect, vi, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import uiReducer, {
  setThemeMode,
  setThemeModeManual,
  setAutoTheme,
  setSidebarCollapsed,
  toggleSidebar,
  type UiState,
} from './uiSlice'

function makeStore(preloaded?: UiState) {
  return configureStore({
    reducer: { ui: uiReducer },
    preloadedState: preloaded ? { ui: preloaded } : undefined,
  })
}

describe('uiSlice reducer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('setThemeMode sets the mode without touching autoTheme', () => {
    const store = makeStore({ themeMode: 'light', autoTheme: true, sidebarCollapsed: false })
    store.dispatch(setThemeMode('dark'))
    expect(store.getState().ui.themeMode).toBe('dark')
    expect(store.getState().ui.autoTheme).toBe(true)
  })

  it('setThemeModeManual sets the mode and turns autoTheme off', () => {
    const store = makeStore({ themeMode: 'light', autoTheme: true, sidebarCollapsed: false })
    store.dispatch(setThemeModeManual('dark'))
    expect(store.getState().ui.themeMode).toBe('dark')
    expect(store.getState().ui.autoTheme).toBe(false)
  })

  it('setAutoTheme(true) recomputes themeMode from the current time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 3, 0)) // 3am -> dark
    const store = makeStore({ themeMode: 'light', autoTheme: false, sidebarCollapsed: false })
    store.dispatch(setAutoTheme(true))
    expect(store.getState().ui.autoTheme).toBe(true)
    expect(store.getState().ui.themeMode).toBe('dark')
  })

  it('setAutoTheme(false) leaves the current themeMode untouched', () => {
    const store = makeStore({ themeMode: 'dark', autoTheme: true, sidebarCollapsed: false })
    store.dispatch(setAutoTheme(false))
    expect(store.getState().ui.autoTheme).toBe(false)
    expect(store.getState().ui.themeMode).toBe('dark')
  })

  it('setSidebarCollapsed sets the flag explicitly', () => {
    const store = makeStore({ themeMode: 'light', autoTheme: true, sidebarCollapsed: false })
    store.dispatch(setSidebarCollapsed(true))
    expect(store.getState().ui.sidebarCollapsed).toBe(true)
    store.dispatch(setSidebarCollapsed(false))
    expect(store.getState().ui.sidebarCollapsed).toBe(false)
  })

  it('toggleSidebar flips the current value', () => {
    const store = makeStore({ themeMode: 'light', autoTheme: true, sidebarCollapsed: false })
    store.dispatch(toggleSidebar())
    expect(store.getState().ui.sidebarCollapsed).toBe(true)
    store.dispatch(toggleSidebar())
    expect(store.getState().ui.sidebarCollapsed).toBe(false)
  })
})

describe('uiSlice initial state (localStorage hydration)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.resetModules()
  })

  it('defaults to autoTheme true and time-derived themeMode when localStorage is empty', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 3, 0)) // 3am -> dark
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    vi.resetModules()
    const { default: freshReducer } = await import('./uiSlice')
    const store = configureStore({ reducer: { ui: freshReducer } })
    expect(store.getState().ui).toEqual({ themeMode: 'dark', autoTheme: true, sidebarCollapsed: false })
  })

  it('ignores a stored themeMode when autoTheme is (implicitly or explicitly) true', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0)) // noon -> light
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
      key === 'incidentops.ui' ? JSON.stringify({ themeMode: 'dark', autoTheme: true, sidebarCollapsed: true }) : null,
    )
    vi.resetModules()
    const { default: freshReducer } = await import('./uiSlice')
    const store = configureStore({ reducer: { ui: freshReducer } })
    expect(store.getState().ui.themeMode).toBe('light')
    expect(store.getState().ui.sidebarCollapsed).toBe(true)
  })

  it('preserves a stored themeMode when autoTheme was turned off', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
      key === 'incidentops.ui' ? JSON.stringify({ themeMode: 'dark', autoTheme: false, sidebarCollapsed: false }) : null,
    )
    vi.resetModules()
    const { default: freshReducer } = await import('./uiSlice')
    const store = configureStore({ reducer: { ui: freshReducer } })
    expect(store.getState().ui.themeMode).toBe('dark')
    expect(store.getState().ui.autoTheme).toBe(false)
  })

  it('falls back to defaults when localStorage holds corrupt JSON', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{not valid')
    vi.resetModules()
    const { default: freshReducer } = await import('./uiSlice')
    const store = configureStore({ reducer: { ui: freshReducer } })
    expect(store.getState().ui.autoTheme).toBe(true)
    expect(store.getState().ui.sidebarCollapsed).toBe(false)
  })

  it('falls back to defaults when localStorage access throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.resetModules()
    const { default: freshReducer } = await import('./uiSlice')
    const store = configureStore({ reducer: { ui: freshReducer } })
    expect(store.getState().ui.autoTheme).toBe(true)
    expect(store.getState().ui.sidebarCollapsed).toBe(false)
  })
})
