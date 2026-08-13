import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import * as chatApi from '@/api/chat'
import sessionReducer from '@/features/session/sessionSlice'
import { useChatMessagesQuery, usePostMessageMutation, useChatSocket } from './useChat'

vi.mock('@/api/chat')

function storeWith(token: string | null) {
  return configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: {
        token,
        refreshToken: 'r',
        user: token ? { id: 'me', email: 'me@example.com', name: 'Alice', orgId: 'org-1', role: 'ADMIN' as const } : null,
      },
    },
  })
}

function wrapperWith(store: ReturnType<typeof storeWith>, queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    )
  }
}

describe('useChatMessagesQuery', () => {
  beforeEach(() => vi.mocked(chatApi.listMessages).mockReset())

  it('is disabled without an incidentId', () => {
    function Probe() {
      const { fetchStatus } = useChatMessagesQuery(undefined)
      return <div data-testid="s">{fetchStatus}</div>
    }
    render(<Probe />, { wrapper: wrapperWith(storeWith('t')) })
    expect(screen.getByTestId('s')).toHaveTextContent('idle')
  })

  it('fetches messages for the incident', async () => {
    vi.mocked(chatApi.listMessages).mockResolvedValue([] as never)
    function Probe() {
      useChatMessagesQuery('inc-1')
      return null
    }
    render(<Probe />, { wrapper: wrapperWith(storeWith('t')) })
    await waitFor(() => expect(chatApi.listMessages).toHaveBeenCalledWith('inc-1'))
  })
})

describe('usePostMessageMutation', () => {
  beforeEach(() => vi.mocked(chatApi.postMessage).mockReset())

  it('posts with the current users name and appends the new message to the cache', async () => {
    vi.mocked(chatApi.postMessage).mockResolvedValue({ id: 'm-1', text: 'hi' } as never)
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Probe() {
      const { mutate } = usePostMessageMutation('inc-1')
      return <button onClick={() => mutate('hi')}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(storeWith('t'), queryClient) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(chatApi.postMessage).toHaveBeenCalledWith('inc-1', 'hi', 'Alice'))
    await waitFor(() => expect(queryClient.getQueryData(['chat', 'inc-1'])).toEqual([{ id: 'm-1', text: 'hi' }]))
  })

  it('does not duplicate a message that is already in the cache (e.g. arrived first via the socket)', async () => {
    vi.mocked(chatApi.postMessage).mockResolvedValue({ id: 'm-1', text: 'hi' } as never)
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(['chat', 'inc-1'], [{ id: 'm-1', text: 'hi' }])
    function Probe() {
      const { mutate } = usePostMessageMutation('inc-1')
      return <button onClick={() => mutate('hi')}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(storeWith('t'), queryClient) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(chatApi.postMessage).toHaveBeenCalled())
    expect(queryClient.getQueryData(['chat', 'inc-1'])).toEqual([{ id: 'm-1', text: 'hi' }])
  })

  it('falls back to "Unknown user" when the session has no name', async () => {
    // Only a nullish name triggers the fallback (`userName ?? 'Unknown user'`) — an empty
    // string is falsy but not nullish, so it would be sent as-is rather than substituted.
    vi.mocked(chatApi.postMessage).mockResolvedValue({ id: 'm-1', text: 'hi' } as never)
    const user = userEvent.setup()
    const store = configureStore({
      reducer: { session: sessionReducer },
      preloadedState: {
        session: {
          token: 't',
          refreshToken: 'r',
          user: { id: 'me', email: 'me@example.com', name: undefined, orgId: 'org-1', role: 'ADMIN' } as never,
        },
      },
    })
    function Probe() {
      const { mutate } = usePostMessageMutation('inc-1')
      return <button onClick={() => mutate('hi')}>go</button>
    }
    render(<Probe />, { wrapper: wrapperWith(store) })
    await user.click(screen.getByText('go'))
    await waitFor(() => expect(chatApi.postMessage).toHaveBeenCalledWith('inc-1', 'hi', 'Unknown user'))
  })
})

describe('useChatSocket', () => {
  class FakeWebSocket {
    static instances: FakeWebSocket[] = []
    onmessage: ((e: { data: string }) => void) | null = null
    closed = false
    url: string
    constructor(url: string) {
      this.url = url
      FakeWebSocket.instances.push(this)
    }
    close() {
      this.closed = true
    }
  }

  const originalWebSocket = global.WebSocket

  beforeEach(() => {
    FakeWebSocket.instances = []
    global.WebSocket = FakeWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    global.WebSocket = originalWebSocket
  })

  it('does not open a socket without an incidentId or token', () => {
    function Probe() {
      useChatSocket(undefined)
      return null
    }
    render(<Probe />, { wrapper: wrapperWith(storeWith('t')) })
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('opens a token-bearing socket URL and appends incoming messages to the cache', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Probe() {
      useChatSocket('inc-1')
      return null
    }
    render(<Probe />, { wrapper: wrapperWith(storeWith('secret-token'), queryClient) })

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
    expect(FakeWebSocket.instances[0].url).toContain('token=secret-token')
    expect(FakeWebSocket.instances[0].url).toContain('inc-1')

    FakeWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({ type: 'message', message: { id: 'm-2', text: 'incoming' } }),
    })
    await waitFor(() => expect(queryClient.getQueryData(['chat', 'inc-1'])).toEqual([{ id: 'm-2', text: 'incoming' }]))
  })

  it('ignores a malformed frame rather than throwing', async () => {
    function Probe() {
      useChatSocket('inc-1')
      return null
    }
    render(<Probe />, { wrapper: wrapperWith(storeWith('t')) })
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
    expect(() => FakeWebSocket.instances[0].onmessage?.({ data: 'not json' })).not.toThrow()
  })

  it('closes the socket on unmount', async () => {
    function Probe() {
      useChatSocket('inc-1')
      return null
    }
    const { unmount } = render(<Probe />, { wrapper: wrapperWith(storeWith('t')) })
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
    unmount()
    expect(FakeWebSocket.instances[0].closed).toBe(true)
  })
})
