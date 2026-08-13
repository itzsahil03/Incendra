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
  useCreateOrgMutation,
  useOwnOrgQuery,
  useOrgSummaryQuery,
  useRotateWebhookSecretMutation,
  useUpdateOrgNameMutation,
} from '@/queries/useOrg'
import { useDeleteOrganizationMutation, useLeaveOrganizationMutation } from '@/queries/useMyOrgs'
import type { OrgResponse } from '@/api/org'
import type { OrgSummaryResponse } from '@/api/auth'
import dayjs from '@/lib/dayjs'

vi.mock('@/queries/useOrg')
vi.mock('@/queries/useMyOrgs')
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockUseOwnOrgQuery = vi.mocked(useOwnOrgQuery)
const mockUseOrgSummaryQuery = vi.mocked(useOrgSummaryQuery)
const mockUseRotateWebhookSecretMutation = vi.mocked(useRotateWebhookSecretMutation)
const mockUseUpdateOrgNameMutation = vi.mocked(useUpdateOrgNameMutation)
const mockUseCreateOrgMutation = vi.mocked(useCreateOrgMutation)
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
  return { orgId: 'org-1', memberCount: 3, adminCount: 2, ...overrides }
}

function renderPage({
  role = 'ADMIN' as Role,
  summary,
  org,
  error = null as unknown,
  isLoading = false,
  updateNameMutateAsync = vi.fn().mockResolvedValue(undefined),
  updateNamePending = false,
  rotateMutate = vi.fn(),
  rotatePending = false,
  createOrgMutateAsync = vi.fn().mockResolvedValue(undefined),
  leaveMutateAsync = vi.fn().mockResolvedValue(undefined),
  leavePending = false,
}: {
  role?: Role
  summary?: OrgSummaryResponse | undefined
  org?: OrgResponse
  error?: unknown
  isLoading?: boolean
  updateNameMutateAsync?: ReturnType<typeof vi.fn>
  updateNamePending?: boolean
  rotateMutate?: ReturnType<typeof vi.fn>
  rotatePending?: boolean
  createOrgMutateAsync?: ReturnType<typeof vi.fn>
  leaveMutateAsync?: ReturnType<typeof vi.fn>
  leavePending?: boolean
} = {}) {
  mockUseOwnOrgQuery.mockReturnValue({ data: org, isLoading, error } as unknown as ReturnType<typeof useOwnOrgQuery>)
  mockUseOrgSummaryQuery.mockReturnValue({ data: summary } as unknown as ReturnType<typeof useOrgSummaryQuery>)
  mockUseRotateWebhookSecretMutation.mockReturnValue({
    mutate: rotateMutate,
    isPending: rotatePending,
  } as unknown as ReturnType<typeof useRotateWebhookSecretMutation>)
  mockUseUpdateOrgNameMutation.mockReturnValue({
    mutateAsync: updateNameMutateAsync,
    isPending: updateNamePending,
  } as unknown as ReturnType<typeof useUpdateOrgNameMutation>)
  mockUseCreateOrgMutation.mockReturnValue({
    mutateAsync: createOrgMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateOrgMutation>)
  mockUseLeaveOrganizationMutation.mockReturnValue({
    mutateAsync: leaveMutateAsync,
    isPending: leavePending,
  } as unknown as ReturnType<typeof useLeaveOrganizationMutation>)
  mockUseDeleteOrganizationMutation.mockReturnValue({
    mutateAsync: vi.fn(),
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

describe('GeneralSettingsPage — loading and error states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a loading state and no page content while the org query is in flight', () => {
    renderPage({ isLoading: true, org: undefined })
    expect(screen.queryByText('General')).not.toBeInTheDocument()
  })

  it('renders ErrorState with the server message for a non-404 error', () => {
    renderPage({
      error: { isAxiosError: true, response: { status: 500, data: { message: 'Org service unavailable' } } },
    })
    expect(screen.getByText('Org service unavailable')).toBeInTheDocument()
  })
})

describe('GeneralSettingsPage — zero-org bootstrap (404 -> CreateOrgCard)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the create-org form for an ADMIN and lets them submit a name', async () => {
    const user = userEvent.setup()
    const createOrgMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderPage({ role: 'ADMIN', error: { isAxiosError: true, response: { status: 404 } }, createOrgMutateAsync })

    expect(screen.getByText(/hasn't been set up yet/i)).toBeInTheDocument()
    const input = screen.getByPlaceholderText('Organization name')
    const button = screen.getByRole('button', { name: /create organization/i })
    expect(button).toBeDisabled()

    await user.type(input, '  New Org  ')
    expect(button).toBeEnabled()
    await user.click(button)

    expect(createOrgMutateAsync).toHaveBeenCalledWith({ name: 'New Org' })
  })

  it('surfaces a toast error when creating the org fails', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const createOrgMutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Name already taken' } },
    })
    renderPage({ role: 'ADMIN', error: { isAxiosError: true, response: { status: 404 } }, createOrgMutateAsync })

    await user.type(screen.getByPlaceholderText('Organization name'), 'Dup Org')
    await user.click(screen.getByRole('button', { name: /create organization/i }))

    expect(createOrgMutateAsync).toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Name already taken')
  })

  it('shows a read-only fallback for a non-admin instead of the create form', () => {
    renderPage({ role: 'VIEWER', error: { isAxiosError: true, response: { status: 404 } } })
    expect(screen.getByText(/ask an admin in your org/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Organization name')).not.toBeInTheDocument()
  })
})

describe('GeneralSettingsPage — Organization Profile name editing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets an admin edit and save the org name', async () => {
    const user = userEvent.setup()
    const updateNameMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderPage({ role: 'ADMIN', org: buildOrg({ name: 'Acme Inc' }), summary: buildSummary(), updateNameMutateAsync })

    const input = screen.getByLabelText('Organization name')
    expect(input).toHaveValue('Acme Inc')
    expect(input).toBeEnabled()
    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).toBeDisabled()

    await user.clear(input)
    await user.type(input, 'Acme Global')
    expect(saveButton).toBeEnabled()
    await user.click(saveButton)

    expect(updateNameMutateAsync).toHaveBeenCalledWith('Acme Global')
  })

  it('keeps Save disabled when the trimmed name equals the current name', async () => {
    const user = userEvent.setup()
    renderPage({ role: 'ADMIN', org: buildOrg({ name: 'Acme Inc' }), summary: buildSummary() })

    const input = screen.getByLabelText('Organization name')
    await user.type(input, '   ')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('shows a toast error when saving the name fails', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const updateNameMutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Name rejected' } },
    })
    renderPage({ role: 'ADMIN', org: buildOrg({ name: 'Acme Inc' }), summary: buildSummary(), updateNameMutateAsync })

    const input = screen.getByLabelText('Organization name')
    await user.clear(input)
    await user.type(input, 'Bad Name')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(toast.error).toHaveBeenCalledWith('Name rejected')
  })

  it('disables the name input and hides Save for a non-admin', () => {
    renderPage({ role: 'VIEWER', org: buildOrg({ name: 'Acme Inc' }), summary: buildSummary() })
    expect(screen.getByLabelText('Organization name')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})

describe('GeneralSettingsPage — Organization Information', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders member/admin counts and the formatted creation date', () => {
    renderPage({ org: buildOrg({ createdAt: '2025-03-14T00:00:00Z' }), summary: buildSummary({ memberCount: 7, adminCount: 3 }) })
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(dayjs('2025-03-14T00:00:00Z').format('MMM D, YYYY'))).toBeInTheDocument()
  })

  it('falls back to an em dash when the summary has not loaded yet', () => {
    renderPage({ org: buildOrg(), summary: undefined })
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })
})

describe('GeneralSettingsPage — Security & Integrations (webhook secret)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true })
    }
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  })

  it('displays the webhook secret read-only and copies it to the clipboard', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderPage({ role: 'ADMIN', org: buildOrg({ webhookSecret: 'whsec_secret1' }), summary: buildSummary() })

    const secretInput = screen.getByDisplayValue('whsec_secret1')
    expect(secretInput).toHaveAttribute('readonly')

    await user.click(screen.getByRole('button', { name: /copy/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('whsec_secret1')
    expect(toast.success).toHaveBeenCalledWith('Copied')
  })

  it('lets an admin rotate the webhook secret', async () => {
    const user = userEvent.setup()
    const rotateMutate = vi.fn()
    renderPage({ role: 'ADMIN', org: buildOrg(), summary: buildSummary(), rotateMutate })

    await user.click(screen.getByRole('button', { name: /rotate/i }))
    expect(rotateMutate).toHaveBeenCalledTimes(1)
  })

  it('hides the Rotate button for a non-admin', () => {
    renderPage({ role: 'RESPONDER', org: buildOrg(), summary: buildSummary() })
    expect(screen.queryByRole('button', { name: /rotate/i })).not.toBeInTheDocument()
  })
})

describe('GeneralSettingsPage — Leave Organization flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens a confirm dialog and leaves the org on confirm', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const leaveMutateAsync = vi.fn().mockResolvedValue(undefined)
    renderPage({ org: buildOrg({ name: 'Acme Inc' }), summary: buildSummary(), leaveMutateAsync })

    await user.click(screen.getByRole('button', { name: /leave organization/i }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Leave Acme Inc?')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Leave' }))

    expect(leaveMutateAsync).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Left the organization')
  })

  it('closes the dialog and shows a toast error when leaving fails', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const leaveMutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'You are the last admin' } },
    })
    renderPage({ org: buildOrg({ name: 'Acme Inc' }), summary: buildSummary(), leaveMutateAsync })

    await user.click(screen.getByRole('button', { name: /leave organization/i }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }))

    expect(toast.error).toHaveBeenCalledWith('You are the last admin')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('cancels without calling the mutation', async () => {
    const user = userEvent.setup()
    const leaveMutateAsync = vi.fn()
    renderPage({ org: buildOrg({ name: 'Acme Inc' }), summary: buildSummary(), leaveMutateAsync })

    await user.click(screen.getByRole('button', { name: /leave organization/i }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(leaveMutateAsync).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
