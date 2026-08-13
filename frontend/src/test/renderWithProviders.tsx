import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import uiReducer, { type UiState } from '@/features/ui/uiSlice'

/** Shared test scaffolding for page/layout components that need Redux + React Query +
 *  a router — every page in this app touches at least one of these three, so building
 *  the wrapper once here avoids ~20 near-identical copies across page test files. */
export function makeTestStore(
  overrides: { session?: Partial<SessionState>; ui?: Partial<UiState> } = {},
) {
  const session: SessionState = {
    token: 't',
    refreshToken: 'r',
    user: { id: 'me', email: 'me@example.com', name: 'Me', orgId: 'org-1', role: 'ADMIN' },
    ...overrides.session,
  }
  const ui: UiState = {
    themeMode: 'dark',
    autoTheme: false,
    sidebarCollapsed: false,
    ...overrides.ui,
  }
  return configureStore({
    reducer: { session: sessionReducer, ui: uiReducer },
    preloadedState: { session, ui },
  })
}

export function makeTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    path,
    store = makeTestStore(),
    queryClient = makeTestQueryClient(),
  }: {
    route?: string
    /** When set, wraps `ui` in a <Route path=... /> so useParams()/relative links resolve. */
    path?: string
    store?: ReturnType<typeof makeTestStore>
    queryClient?: QueryClient
  } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            {path ? <Routes><Route path={path} element={children as ReactElement} /></Routes> : children}
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    )
  }
  return render(ui, { wrapper: Wrapper })
}

/** jsdom has no ResizeObserver/matchMedia/scrollIntoView/pointer-capture — every test
 *  touching a Radix-based component (Select, Dialog, Sheet, DropdownMenu, Tooltip,
 *  Combobox, Command, AlertDialog, Tabs) needs these stubbed once in beforeAll(). */
export function stubRadixEnvironment() {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = (() => false) as unknown as typeof Element.prototype.hasPointerCapture
  Element.prototype.setPointerCapture = (() => {}) as unknown as typeof Element.prototype.setPointerCapture
  Element.prototype.releasePointerCapture = (() => {}) as unknown as typeof Element.prototype.releasePointerCapture
}
