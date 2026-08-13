import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as usersApi from '@/api/users'
import { useCreateUserMutation, useUpdateUserMutation } from './useUsers'

vi.mock('@/api/users', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(usersApi.createUser).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(usersApi.updateUser).mockReset().mockResolvedValue(undefined as never)
})

describe('useCreateUserMutation', () => {
  it('passes the body through and invalidates the users list', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useCreateUserMutation()
      return <button onClick={() => mutate({ email: 'new@example.com' } as never)}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    // mutationFn is passed directly (not wrapped), so react-query calls it with its own
    // second "context" argument (client/meta/mutationKey) too — only the first arg matters.
    await waitFor(() => expect(vi.mocked(usersApi.createUser).mock.calls[0]?.[0]).toEqual({ email: 'new@example.com' }))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
  })
})

describe('useUpdateUserMutation', () => {
  it('splits id from the rest of the body and invalidates the users list', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function Probe() {
      const { mutate } = useUpdateUserMutation()
      return <button onClick={() => mutate({ id: 'u1', name: 'New Name' })}>go</button>
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(usersApi.updateUser).toHaveBeenCalledWith('u1', { name: 'New Name' }))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
  })
})
