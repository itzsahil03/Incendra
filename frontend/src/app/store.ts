import { configureStore } from '@reduxjs/toolkit'
import sessionReducer from '@/features/session/sessionSlice'
import uiReducer from '@/features/ui/uiSlice'

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    ui: uiReducer,
  },
})

// Both slices are small and explicitly client-only (session/theme/sidebar) — persisting
// the whole store on every change is simpler and safe than persisting each slice
// separately, since neither holds anything server-derived that could go stale.
store.subscribe(() => {
  const state = store.getState()
  localStorage.setItem('incidentops.session', JSON.stringify(state.session))
  localStorage.setItem('incidentops.ui', JSON.stringify(state.ui))
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
