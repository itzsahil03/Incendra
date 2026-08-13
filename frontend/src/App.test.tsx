import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import sessionReducer, { type SessionState } from '@/features/session/sessionSlice'
import uiReducer, { type UiState } from '@/features/ui/uiSlice'
import App from './App'

// App.tsx is a routing shell — its own job is choosing which page renders for which
// path/role, not the pages' internal behavior (each page has its own dedicated test
// suite). Stub every routed page + the two shells with a marker so assertions here can
// stay about routing, not about each page's data-fetching.
function stub(name: string) {
  return () => <div>{name}</div>
}

vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: () => <div>AppLayoutShell<Outlet /></div> }))
vi.mock('@/components/layout/PublicShell', () => ({ PublicShell: () => <div>PublicShellChrome<Outlet /></div> }))

vi.mock('@/pages/public/HomePage', () => ({ HomePage: stub('HomePage') }))
vi.mock('@/pages/public/ServicesPage', () => ({ ServicesPage: stub('ServicesPage') }))
vi.mock('@/pages/public/AboutPage', () => ({ AboutPage: stub('AboutPage') }))
vi.mock('@/pages/public/ContactPage', () => ({ ContactPage: stub('ContactPage') }))
vi.mock('@/pages/auth/LoginPage', () => ({ LoginPage: stub('LoginPage') }))
vi.mock('@/pages/auth/RegisterPage', () => ({ RegisterPage: stub('RegisterPage') }))
vi.mock('@/pages/auth/ForgotPasswordPage', () => ({ ForgotPasswordPage: stub('ForgotPasswordPage') }))
vi.mock('@/pages/auth/ResetPasswordPage', () => ({ ResetPasswordPage: stub('ResetPasswordPage') }))
vi.mock('@/pages/auth/WelcomePage', () => ({ WelcomePage: stub('WelcomePage') }))
vi.mock('@/pages/auth/InvitationPage', () => ({ InvitationPage: stub('InvitationPage') }))
vi.mock('@/pages/DashboardPage', () => ({ DashboardPage: stub('DashboardPage') }))
vi.mock('@/pages/ActivityPage', () => ({ ActivityPage: stub('ActivityPage') }))
vi.mock('@/pages/incidents/IncidentsListPage', () => ({ IncidentsListPage: stub('IncidentsListPage') }))
vi.mock('@/pages/incidents/IncidentDetailPage', () => ({ IncidentDetailPage: stub('IncidentDetailPage') }))
vi.mock('@/pages/AlertsPage', () => ({ AlertsPage: stub('AlertsPage') }))
vi.mock('@/pages/alerts/AlertDetailPage', () => ({ AlertDetailPage: stub('AlertDetailPage') }))
vi.mock('@/pages/AnalyticsPage', () => ({ AnalyticsPage: stub('AnalyticsPage') }))
vi.mock('@/pages/NotificationsPage', () => ({ NotificationsPage: stub('NotificationsPage') }))
vi.mock('@/pages/settings/SettingsShell', () => ({ SettingsShell: () => <div>SettingsShell<Outlet /></div> }))
vi.mock('@/pages/settings/GeneralSettingsPage', () => ({ GeneralSettingsPage: stub('GeneralSettingsPage') }))
vi.mock('@/pages/settings/MembersPage', () => ({ MembersPage: stub('MembersPage') }))
vi.mock('@/pages/settings/InvitationsPage', () => ({ InvitationsPage: stub('InvitationsPage') }))
vi.mock('@/pages/settings/RolesSettingsPage', () => ({ RolesSettingsPage: stub('RolesSettingsPage') }))
vi.mock('@/pages/settings/AuditLogSettingsPage', () => ({ AuditLogSettingsPage: stub('AuditLogSettingsPage') }))
vi.mock('@/pages/settings/ProfilePage', () => ({ ProfilePage: stub('ProfilePage') }))
vi.mock('@/pages/settings/ChangePasswordPage', () => ({ ChangePasswordPage: stub('ChangePasswordPage') }))
vi.mock('@/pages/integrations/IntegrationsShell', () => ({ IntegrationsShell: () => <div>IntegrationsShell<Outlet /></div> }))
vi.mock('@/pages/integrations/OverviewPage', () => ({ OverviewPage: stub('OverviewPage') }))
vi.mock('@/pages/integrations/ApiKeysPage', () => ({ ApiKeysPage: stub('ApiKeysPage') }))
vi.mock('@/pages/integrations/WebhooksPage', () => ({ WebhooksPage: stub('WebhooksPage') }))
vi.mock('@/pages/integrations/WebhookDetailPage', () => ({ WebhookDetailPage: stub('WebhookDetailPage') }))
vi.mock('@/pages/integrations/DeliveryLogsPage', () => ({ DeliveryLogsPage: stub('DeliveryLogsPage') }))
vi.mock('@/pages/integrations/ConnectedAppsPage', () => ({ ConnectedAppsPage: stub('ConnectedAppsPage') }))
vi.mock('@/pages/NotFoundPage', () => ({ NotFoundPage: stub('NotFoundPage') }))

function renderApp(
  path: string,
  session: SessionState = { token: null, refreshToken: null, user: null },
  ui: Partial<UiState> = {},
) {
  const uiState: UiState = { themeMode: 'light', autoTheme: false, sidebarCollapsed: false, ...ui }
  const store = configureStore({
    reducer: { session: sessionReducer, ui: uiReducer },
    preloadedState: { session, ui: uiState },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  )
}

const loggedInAdmin: SessionState = {
  token: 't',
  refreshToken: 'r',
  user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' },
}
const loggedInViewer: SessionState = {
  token: 't',
  refreshToken: 'r',
  user: { id: 'u1', email: 'a@example.com', name: 'Alice', orgId: 'org-1', role: 'VIEWER' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('App — public routes', () => {
  it('renders the home page at /', () => {
    renderApp('/')
    expect(screen.getByText('PublicShellChrome')).toBeInTheDocument()
    expect(screen.getByText('HomePage')).toBeInTheDocument()
  })

  it.each([
    ['/services', 'ServicesPage'],
    ['/about', 'AboutPage'],
    ['/contact', 'ContactPage'],
    ['/login', 'LoginPage'],
    ['/register', 'RegisterPage'],
    ['/forgot-password', 'ForgotPasswordPage'],
    ['/reset-password', 'ResetPasswordPage'],
    ['/welcome', 'WelcomePage'],
  ])('renders %s', (path, name) => {
    renderApp(path)
    expect(screen.getByText(name)).toBeInTheDocument()
  })

  it('renders the invitation page for a token path', () => {
    renderApp('/invitations/tok-123')
    expect(screen.getByText('InvitationPage')).toBeInTheDocument()
  })

  it('renders NotFoundPage for an unknown path', () => {
    renderApp('/nonexistent')
    expect(screen.getByText('NotFoundPage')).toBeInTheDocument()
  })
})

describe('App — protected /app routes require a session', () => {
  it('redirects to /login when logged out', () => {
    renderApp('/app')
    expect(screen.getByText('LoginPage')).toBeInTheDocument()
  })

  it('redirects webhooks integrations when logged out too', () => {
    renderApp('/app/integrations')
    expect(screen.getByText('LoginPage')).toBeInTheDocument()
  })
})

describe('App — protected /app routes, logged in', () => {
  it('renders the dashboard at /app', () => {
    renderApp('/app', loggedInAdmin)
    expect(screen.getByText('AppLayoutShell')).toBeInTheDocument()
    expect(screen.getByText('DashboardPage')).toBeInTheDocument()
  })

  it.each([
    ['/app/incidents', 'IncidentsListPage'],
    ['/app/incidents/inc-1', 'IncidentDetailPage'],
    ['/app/alerts', 'AlertsPage'],
    ['/app/alerts/a-1', 'AlertDetailPage'],
    ['/app/activity', 'ActivityPage'],
    ['/app/analytics', 'AnalyticsPage'],
    ['/app/notifications', 'NotificationsPage'],
  ])('renders %s', (path, name) => {
    renderApp(path, loggedInAdmin)
    expect(screen.getByText(name)).toBeInTheDocument()
  })

  it('redirects the legacy /app/webhooks path into integrations/webhooks', () => {
    renderApp('/app/webhooks', loggedInAdmin)
    expect(screen.getByText('IntegrationsShell')).toBeInTheDocument()
    expect(screen.getByText('WebhooksPage')).toBeInTheDocument()
  })

  it('redirects /app/settings index to general', () => {
    renderApp('/app/settings', loggedInAdmin)
    expect(screen.getByText('SettingsShell')).toBeInTheDocument()
    expect(screen.getByText('GeneralSettingsPage')).toBeInTheDocument()
  })

  it.each([
    ['/app/settings/general', 'GeneralSettingsPage'],
    ['/app/settings/members', 'MembersPage'],
    ['/app/settings/invitations', 'InvitationsPage'],
    ['/app/settings/audit-log', 'AuditLogSettingsPage'],
    ['/app/settings/profile', 'ProfilePage'],
    ['/app/settings/password', 'ChangePasswordPage'],
  ])('renders settings route %s', (path, name) => {
    renderApp(path, loggedInAdmin)
    expect(screen.getByText(name)).toBeInTheDocument()
  })
})

describe('App — ADMIN-only routes', () => {
  it('allows an ADMIN into settings/roles', () => {
    renderApp('/app/settings/roles', loggedInAdmin)
    expect(screen.getByText('RolesSettingsPage')).toBeInTheDocument()
  })

  it('bounces a non-admin away from settings/roles back to /app', () => {
    renderApp('/app/settings/roles', loggedInViewer)
    expect(screen.getByText('DashboardPage')).toBeInTheDocument()
  })

  it('allows an ADMIN into Integrations', () => {
    renderApp('/app/integrations', loggedInAdmin)
    expect(screen.getByText('IntegrationsShell')).toBeInTheDocument()
    expect(screen.getByText('OverviewPage')).toBeInTheDocument()
  })

  it('bounces a non-admin away from Integrations back to /app', () => {
    renderApp('/app/integrations', loggedInViewer)
    expect(screen.getByText('DashboardPage')).toBeInTheDocument()
  })

  it.each([
    ['/app/integrations/overview', 'OverviewPage'],
    ['/app/integrations/keys', 'ApiKeysPage'],
    ['/app/integrations/webhooks', 'WebhooksPage'],
    ['/app/integrations/webhooks/wh-1', 'WebhookDetailPage'],
    ['/app/integrations/deliveries', 'DeliveryLogsPage'],
    ['/app/integrations/apps', 'ConnectedAppsPage'],
  ])('renders integrations route %s', (path, name) => {
    renderApp(path, loggedInAdmin)
    expect(screen.getByText(name)).toBeInTheDocument()
  })
})

describe('App — theme handling', () => {
  it('applies the dark class to <html> when themeMode is dark', () => {
    renderApp('/', { token: null, refreshToken: null, user: null }, { themeMode: 'dark', autoTheme: false })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not apply the dark class when themeMode is light', () => {
    renderApp('/', { token: null, refreshToken: null, user: null }, { themeMode: 'light', autoTheme: false })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
