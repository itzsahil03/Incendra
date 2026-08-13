import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setThemeMode } from '@/features/ui/uiSlice'
import { themeModeForTime } from '@/lib/timeOfDay'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { PublicShell } from '@/components/layout/PublicShell'

import { HomePage } from '@/pages/public/HomePage'
import { ServicesPage } from '@/pages/public/ServicesPage'
import { AboutPage } from '@/pages/public/AboutPage'
import { ContactPage } from '@/pages/public/ContactPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { WelcomePage } from '@/pages/auth/WelcomePage'
import { InvitationPage } from '@/pages/auth/InvitationPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ActivityPage } from '@/pages/ActivityPage'
import { IncidentsListPage } from '@/pages/incidents/IncidentsListPage'
import { IncidentDetailPage } from '@/pages/incidents/IncidentDetailPage'
import { AlertsPage } from '@/pages/AlertsPage'
import { AlertDetailPage } from '@/pages/alerts/AlertDetailPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { SettingsShell } from '@/pages/settings/SettingsShell'
import { GeneralSettingsPage } from '@/pages/settings/GeneralSettingsPage'
import { MembersPage } from '@/pages/settings/MembersPage'
import { InvitationsPage } from '@/pages/settings/InvitationsPage'
import { RolesSettingsPage } from '@/pages/settings/RolesSettingsPage'
import { AuditLogSettingsPage } from '@/pages/settings/AuditLogSettingsPage'
import { ProfilePage } from '@/pages/settings/ProfilePage'
import { ChangePasswordPage } from '@/pages/settings/ChangePasswordPage'
import { IntegrationsShell } from '@/pages/integrations/IntegrationsShell'
import { OverviewPage } from '@/pages/integrations/OverviewPage'
import { ApiKeysPage } from '@/pages/integrations/ApiKeysPage'
import { WebhooksPage } from '@/pages/integrations/WebhooksPage'
import { WebhookDetailPage } from '@/pages/integrations/WebhookDetailPage'
import { DeliveryLogsPage } from '@/pages/integrations/DeliveryLogsPage'
import { ConnectedAppsPage } from '@/pages/integrations/ConnectedAppsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function App() {
  const themeMode = useAppSelector((s) => s.ui.themeMode)
  const autoTheme = useAppSelector((s) => s.ui.autoTheme)
  const dispatch = useAppDispatch()

  // While auto-theme is on, the theme tracks the local clock — re-checked every minute
  // so a session left open across the day/night boundary flips without a reload. A
  // manual toggle in Settings turns this off so the user's choice sticks instead.
  useEffect(() => {
    if (!autoTheme) return
    const tick = () => dispatch(setThemeMode(themeModeForTime()))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [dispatch, autoTheme])

  // Drives Tailwind's `dark:` variant across the app.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark')
  }, [themeMode])

  return (
    <>
      <Toaster theme={themeMode} position="bottom-right" richColors />
      <TooltipProvider>
        <Routes>
          <Route element={<PublicShell />}>
            <Route index element={<HomePage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="welcome" element={<WelcomePage />} />
            <Route path="invitations/:token" element={<InvitationPage />} />
          </Route>

          <Route path="/app" element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="incidents" element={<IncidentsListPage />} />
              <Route path="incidents/:id" element={<IncidentDetailPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="alerts/:id" element={<AlertDetailPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="webhooks" element={<Navigate to="/app/integrations/webhooks" replace />} />

              <Route path="settings" element={<SettingsShell />}>
                <Route index element={<Navigate to="general" replace />} />
                <Route path="general" element={<GeneralSettingsPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="invitations" element={<InvitationsPage />} />
                <Route path="audit-log" element={<AuditLogSettingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="password" element={<ChangePasswordPage />} />

                <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                  <Route path="roles" element={<RolesSettingsPage />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="integrations" element={<IntegrationsShell />}>
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<OverviewPage />} />
                  <Route path="keys" element={<ApiKeysPage />} />
                  <Route path="webhooks" element={<WebhooksPage />} />
                  <Route path="webhooks/:id" element={<WebhookDetailPage />} />
                  <Route path="deliveries" element={<DeliveryLogsPage />} />
                  <Route path="apps" element={<ConnectedAppsPage />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </TooltipProvider>
    </>
  )
}

export default App
