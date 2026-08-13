import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { CreateOrganizationDialog } from './CreateOrganizationDialog'
import { useCreateOrgMembershipMutation } from '@/queries/useMyOrgs'

vi.mock('@/queries/useMyOrgs')
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockUseCreateOrgMembershipMutation = vi.mocked(useCreateOrgMembershipMutation)

function mockMutation(overrides: Partial<ReturnType<typeof useCreateOrgMembershipMutation>> = {}) {
  mockUseCreateOrgMembershipMutation.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCreateOrgMembershipMutation>)
}

describe('CreateOrganizationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    mockMutation()
    render(<CreateOrganizationDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText('Create organization')).not.toBeInTheDocument()
  })

  it('renders the dialog title and input when open', () => {
    mockMutation()
    render(<CreateOrganizationDialog open onOpenChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Create organization' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Organization name')).toBeInTheDocument()
  })

  it('disables the create button until a name is entered', async () => {
    mockMutation()
    const user = userEvent.setup()
    render(<CreateOrganizationDialog open onOpenChange={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Create organization' })
    expect(button).toBeDisabled()
    await user.type(screen.getByPlaceholderText('Organization name'), 'Acme')
    expect(button).toBeEnabled()
  })

  it('keeps the create button disabled for whitespace-only input', async () => {
    mockMutation()
    const user = userEvent.setup()
    render(<CreateOrganizationDialog open onOpenChange={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Organization name'), '   ')
    expect(screen.getByRole('button', { name: 'Create organization' })).toBeDisabled()
  })

  it('submits the trimmed name, shows a success toast, and closes on success', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockMutation({ mutateAsync })
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<CreateOrganizationDialog open onOpenChange={onOpenChange} />)
    await user.type(screen.getByPlaceholderText('Organization name'), '  Acme Inc  ')
    await user.click(screen.getByRole('button', { name: 'Create organization' }))
    expect(mutateAsync).toHaveBeenCalledWith('Acme Inc')
    expect(toast.success).toHaveBeenCalledWith('Organization created')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('submits on Enter key in the input', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockMutation({ mutateAsync })
    const user = userEvent.setup()
    render(<CreateOrganizationDialog open onOpenChange={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Organization name'), 'Acme{Enter}')
    expect(mutateAsync).toHaveBeenCalledWith('Acme')
  })

  it('shows an error message and does not close on failure', async () => {
    const mutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Name already taken' } },
    })
    mockMutation({ mutateAsync })
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<CreateOrganizationDialog open onOpenChange={onOpenChange} />)
    await user.type(screen.getByPlaceholderText('Organization name'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Create organization' }))
    expect(await screen.findByText('Name already taken')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('shows a "Creating…" label while pending and disables the button', () => {
    mockMutation({ isPending: true })
    render(<CreateOrganizationDialog open onOpenChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
  })

  it('does not submit when the name is empty (guards on click too)', async () => {
    const mutateAsync = vi.fn()
    mockMutation({ mutateAsync })
    render(<CreateOrganizationDialog open onOpenChange={vi.fn()} />)
    // Button is disabled, so clicking normally can't fire it — this just documents the guard.
    expect(screen.getByRole('button', { name: 'Create organization' })).toBeDisabled()
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
