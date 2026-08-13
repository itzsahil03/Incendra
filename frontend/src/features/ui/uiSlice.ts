import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { themeModeForTime } from '@/lib/timeOfDay'

export type ThemeMode = 'light' | 'dark'

export interface UiState {
  themeMode: ThemeMode
  /** When true, App.tsx's periodic tick keeps themeMode in sync with local time.
   *  A manual toggle in Settings flips this off so the user's choice sticks instead
   *  of being overwritten within a minute. */
  autoTheme: boolean
  sidebarCollapsed: boolean
}

const STORAGE_KEY = 'incidentops.ui'

function loadInitialState(): UiState {
  let stored: Partial<UiState> = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) stored = JSON.parse(raw) as Partial<UiState>
  } catch {
    // corrupt/blocked storage — fall through to defaults
  }
  const autoTheme = stored.autoTheme ?? true
  // themeMode only survives a reload if the user turned auto-theme off — otherwise it
  // always starts from the current local time, not a stale stored preference (a theme
  // picked at 11pm last night shouldn't still be dark at 9am today).
  const themeMode = autoTheme ? themeModeForTime() : (stored.themeMode ?? themeModeForTime())
  return { themeMode, autoTheme, sidebarCollapsed: stored.sidebarCollapsed ?? false }
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: loadInitialState(),
  reducers: {
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload
    },
    /** Manual override from Settings — sets the mode and stops auto-following time. */
    setThemeModeManual(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload
      state.autoTheme = false
    },
    setAutoTheme(state, action: PayloadAction<boolean>) {
      state.autoTheme = action.payload
      if (action.payload) state.themeMode = themeModeForTime()
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
  },
})

export const { setThemeMode, setThemeModeManual, setAutoTheme, setSidebarCollapsed, toggleSidebar } = uiSlice.actions
export default uiSlice.reducer
