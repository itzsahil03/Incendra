import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import sessionReducer from '@/features/session/sessionSlice'
import type { Role } from '@/features/session/sessionSlice'
import { GeneralSettingsPage } from './GeneralSettingsPage'
import {
  useOwnOrgQuery,
  useOrgSummaryQuery,
  useRotateWebhookSecretMutation,
  useUpdateOrgNameMutation,
} from '@/queries/useOrg'
import { useDeleteOrganizationMutation, useLeaveOrganizationMutation } from '@/queries/useMyOrgs'
import type { OrgResponse } from '@/api/org'
import type { OrgSummaryResponse } from '@/api/auth'

vi.mock('@/queries/useOrg')
vi.mock('@/queries/useMyOrgs')

const mockUseOwnOrgQuery = vi.mocked(useOwnOrgQuery)
const mockUseOrgSummaryQuery = vi.mocked(useOrgSummaryQuery)
const mockUseRotateWebhookSecretMutation = vi.mocked(useRotateWebhookSecretMutation)
const mockUseUpdateOrgNameMutation = vi.mocked(useUpdateOrgNameMutation)
const mockUseDeleteOrganizationMutation = vi.mocked(useDeleteOrganizationMutation)
const mockUseLeaveOrganizationMutation = vi.mocked(useLeaveOrganizationMutation)

function buildOrg(overrides: Partial<OrgResponse> = {}): OrgResponse {
  return {
    id: 'org-1',
    name: 'Acme Inc',
    webhookSecret: 'whsec_abc123',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildSummary(overrides: Partial<OrgSummaryResponse> = {}): OrgSummaryResponse {
  return { orgId: 'org-1', memberCount: 3, adminCount: 1, ...overrides }
}

function renderPage({
  role = 'ADMIN' as Role,
  summary = buildSummary(),
  org = buildOrg(),
  deleteMutateAsync = vi.fn().mockResolvedValue(undefined),
}: {
  role?: Role
  summary?: OrgSummaryResponse
  org?: OrgResponse
  deleteMutateAsync?: ReturnType<typeof vi.fn>
} = {}) {
  mockUseOwnOrgQuery.mockReturnValue({ data: org, isLoading: false, error: null } as unknown as ReturnType<typeof useOwnOrgQuery>)
  mockUseOrgSummaryQuery.mockReturnValue({ data: summary } as unknown as ReturnType<typeof useOrgSummaryQuery>)
  mockUseRotateWebhookSecretMutation.mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<
    typeof useRotateWebhookSecretMutation
  >)
  mockUseUpdateOrgNameMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<
    typeof useUpdateOrgNameMutation
  >)
  mockUseLeaveOrganizationMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<
    typeof useLeaveOrganizationMutation
  >)
  mockUseDeleteOrganizationMutation.mockReturnValue({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteOrganizationMutation>)

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: {
        token: 't',
        refreshToken: 'r',
        user: { id: 'me', email: 'me@example.com', name: 'Me', orgId: 'org-1', role },
      },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    )
  }

  return render(<GeneralSettingsPage />, { wrapper: Wrapper })
}

describe('GeneralSettingsPage — Delete Organization card visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the Delete Organization card when the current user is ADMIN and the sole admin', () => {
    renderPage({ role: 'ADMIN', summary: buildSummary({ adminCount: 1 }) })
    expect(screen.getByText('Delete Organization')).toBeInTheDocument()
  })

  it('hides the Delete Organization card when there is more than one admin', () => {
    renderPage({ role: 'ADMIN', summary: buildSummary({ adminCount: 2 }) })
    expect(screen.queryByText('Delete Organization')).not.toBeInTheDocument()
  })

  it('hides the Delete Organization card for a non-admin, even if adminCount is 1', () => {
    renderPage({ role: 'RESPONDER', summary: buildSummary({ adminCount: 1 }) })
    expect(screen.queryByText('Delete Organization')).not.toBeInTheDocument()
  })
})

describe('GeneralSettingsPage — Delete Organization dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the confirm button disabled until a password is entered', async () => {
    const user = userEvent.setup()
    renderPage({ role: 'ADMIN', summary: buildSummary({ adminCount: 1 }) })

    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    const dialog = await screen.findByRole('dialog')
    const confirmButton = within(dialog).getByRole('button', { name: 'Delete organization' })
    expect(confirmButton).toBeDisabled()
  })

  it('shows the server error and does not navigate away when the password is rejected', async () => {
    const user = userEvent.setup()
    const deleteMutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Incorrect password' } },
    })
    renderPage({ role: 'ADMIN', summary: buildSummary({ adminCount: 1 }), deleteMutateAsync })

    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    const passwordInput = await screen.findByPlaceholderText('Enter your password to confirm')
    await user.type(passwordInput, 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Delete organization' }))

    expect(await screen.findByText('Incorrect password')).toBeInTheDocument()
    expect(deleteMutateAsync).toHaveBeenCalledTimes(1)
    expect(deleteMutateAsync).toHaveBeenCalledWith('wrong-password')
  })

  it('calls the delete mutation once with the entered password on a normal submit', async () => {
    const user = userEvent.setup()
    const deleteMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderPage({ role: 'ADMIN', summary: buildSummary({ adminCount: 1 }), deleteMutateAsync })

    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    const passwordInput = await screen.findByPlaceholderText('Enter your password to confirm')
    await user.type(passwordInput, 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Delete organization' }))

    expect(deleteMutateAsync).toHaveBeenCalledTimes(1)
    expect(deleteMutateAsync).toHaveBeenCalledWith('correct-password')
  })
})
