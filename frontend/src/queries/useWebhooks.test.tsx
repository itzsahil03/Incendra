import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as orgApi from '@/api/org'
import {
  useWebhooksQuery,
  useWebhookQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useDeleteWebhookMutation,
  useRotateWebhookSecretMutation,
} from './useWebhooks'

vi.mock('@/api/org')

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(orgApi.listWebhooks).mockReset()
  vi.mocked(orgApi.createWebhook).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(orgApi.updateWebhook).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(orgApi.deleteWebhook).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(orgApi.rotateWebhookOutboundSecret).mockReset().mockResolvedValue(undefined as never)
})

describe('useWebhooksQuery', () => {
  it('lists webhooks', async () => {
    vi.mocked(orgApi.listWebhooks).mockResolvedValue([{ id: 'wh-1' }] as never)
    function Probe() {
      const { data } = useWebhooksQuery()
      return <div data-testid="s">{data?.length ?? 'loading'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('1'))
  })
})

describe('useWebhookQuery', () => {
  it('finds the matching webhook by id from the list query', async () => {
    vi.mocked(orgApi.listWebhooks).mockResolvedValue([{ id: 'wh-1', url: 'a' }, { id: 'wh-2', url: 'b' }] as never)
    function Probe() {
      const webhook = useWebhookQuery('wh-2')
      return <div data-testid="url">{webhook?.url ?? 'none'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('b'))
  })

  it('is undefined when no webhook matches the id', async () => {
    vi.mocked(orgApi.listWebhooks).mockResolvedValue([{ id: 'wh-1', url: 'a' }] as never)
    function Probe() {
      const webhook = useWebhookQuery('missing')
      return <div data-testid="url">{webhook ? webhook.url : 'none'}</div>
    }
    render(<Probe />, { wrapper })
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('none'))
  })
})

describe('webhook mutations invalidate the webhooks list', () => {
  function testMutationInvalidates<T>(useHook: () => { mutate: (v: T) => void }, arg: T) {
    return async () => {
      const user = userEvent.setup()
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      function Probe() {
        const { mutate } = useHook()
        return <button onClick={() => mutate(arg)}>go</button>
      }
      render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      )
      await user.click(screen.getByText('go'))
      await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['webhooks'] }))
    }
  }

  it('useCreateWebhookMutation', testMutationInvalidates(useCreateWebhookMutation, { url: 'https://x', subscribedTopics: [] } as never))
  it('useDeleteWebhookMutation', testMutationInvalidates(useDeleteWebhookMutation, 'wh-1' as never))
  it('useRotateWebhookSecretMutation', testMutationInvalidates(useRotateWebhookSecretMutation, 'wh-1' as never))

  it('useUpdateWebhookMutation splits id from the rest of the body', async () => {
    const user = userEvent.setup()
    function Probe() {
      const { mutate } = useUpdateWebhookMutation()
      return <button onClick={() => mutate({ id: 'wh-1', url: 'https://new', active: false })}>go</button>
    }
    render(<Probe />, { wrapper })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(orgApi.updateWebhook).toHaveBeenCalledWith('wh-1', { url: 'https://new', active: false }))
  })
})
