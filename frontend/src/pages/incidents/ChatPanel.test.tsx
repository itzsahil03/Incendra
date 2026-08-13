import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import type { ReactNode } from 'react'
import sessionReducer from '@/features/session/sessionSlice'
import type { SessionState } from '@/features/session/sessionSlice'
import { ChatPanel } from './ChatPanel'
import { useChatMessagesQuery, useChatSocket, usePostMessageMutation } from '@/queries/useChat'
import { useAllUsersQuery } from '@/queries/useUsers'
import type { ChatMessageResponse } from '@/api/chat'
import type { UserResponse } from '@/api/users'

vi.mock('@/queries/useChat')
vi.mock('@/queries/useUsers')

const mockUseChatMessagesQuery = vi.mocked(useChatMessagesQuery)
const mockUseChatSocket = vi.mocked(useChatSocket)
const mockUsePostMessageMutation = vi.mocked(usePostMessageMutation)
const mockUseAllUsersQuery = vi.mocked(useAllUsersQuery)

const CURRENT_USER_ID = 'user-me'

function buildStore(sessionOverrides: Partial<SessionState['user']> = {}) {
  const session: SessionState = {
    token: 'token',
    refreshToken: 'refresh',
    user: {
      id: CURRENT_USER_ID,
      email: 'me@example.com',
      name: 'Me',
      orgId: 'org-1',
      role: 'RESPONDER',
      ...sessionOverrides,
    },
  }
  return configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session },
  })
}

function renderChatPanel(messages: ChatMessageResponse[], accounts: UserResponse[] = []) {
  mockUseChatMessagesQuery.mockReturnValue({ data: messages, isLoading: false } as unknown as ReturnType<typeof useChatMessagesQuery>)
  mockUseChatSocket.mockReturnValue(undefined)
  mockUsePostMessageMutation.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePostMessageMutation>)
  mockUseAllUsersQuery.mockReturnValue({ data: accounts, isLoading: false } as unknown as ReturnType<typeof useAllUsersQuery>)

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const store = buildStore()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Provider>
    )
  }

  return render(<ChatPanel incidentId="incident-1" />, { wrapper: Wrapper })
}

function account(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 'user-x',
    email: 'x@example.com',
    name: 'Someone',
    orgId: 'org-1',
    role: 'RESPONDER',
    notificationPrefs: null,
    createdAt: '2026-01-01T00:00:00Z',
    active: true,
    ...overrides,
  }
}

function message(overrides: Partial<ChatMessageResponse> = {}): ChatMessageResponse {
  return {
    id: 'msg-1',
    orgId: 'org-1',
    incidentId: 'incident-1',
    userId: 'user-x',
    userName: 'Someone',
    text: 'hello',
    kind: 'user',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a message with the directory-resolved name when present', () => {
    renderChatPanel(
      [message({ id: 'm1', userId: 'user-bob', userName: 'Bob', text: 'Investigating now' })],
      [account({ id: 'user-bob', name: 'Bob' })],
    )

    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Investigating now')).toBeInTheDocument()
  })

  it('labels the current user\'s own message as "You"', () => {
    renderChatPanel([message({ id: 'm1', userId: CURRENT_USER_ID, userName: 'Me', text: 'My update' })], [
      account({ id: CURRENT_USER_ID, name: 'Me' }),
    ])

    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.queryByText('Me', { selector: 'span.font-bold' })).not.toBeInTheDocument()
  })

  it('resolves an "anon"-stored message via the user directory', () => {
    renderChatPanel(
      [message({ id: 'm1', userId: 'user-carol', userName: 'anon', text: 'Legacy message' })],
      [account({ id: 'user-carol', name: 'Carol' })],
    )

    expect(screen.getByText('Carol')).toBeInTheDocument()
  })

  it('resolves a null userName message via the user directory too', () => {
    renderChatPanel(
      [message({ id: 'm1', userId: 'user-dave', userName: null, text: 'Also legacy' })],
      [account({ id: 'user-dave', name: 'Dave' })],
    )

    expect(screen.getByText('Dave')).toBeInTheDocument()
  })

  it('appends "(Deactivated)" for a message from a deactivated poster', () => {
    renderChatPanel(
      [message({ id: 'm1', userId: 'user-eve', userName: 'anon', text: 'Old note' })],
      [account({ id: 'user-eve', name: 'Eve', active: false })],
    )

    expect(screen.getByText('Eve (Deactivated)')).toBeInTheDocument()
  })

  it('shows the empty state when there are no messages', () => {
    renderChatPanel([], [])
    expect(screen.getByText('No updates yet — be the first to comment.')).toBeInTheDocument()
  })

  it('renders system messages centered without an avatar name row, and filters them out under the comments filter', () => {
    const messages = [
      message({ id: 'sys1', kind: 'system', userId: null, userName: null, text: 'Incident created' }),
      message({ id: 'm1', kind: 'user', userId: 'user-x', userName: 'Someone', text: 'A real comment' }),
    ]
    const { rerender } = renderChatPanel(messages, [account({ id: 'user-x', name: 'Someone' })])
    expect(screen.getByText('Incident created')).toBeInTheDocument()
    expect(screen.getByText('A real comment')).toBeInTheDocument()

    // comments filter should hide the system message
    mockUseChatMessagesQuery.mockReturnValue({ data: messages, isLoading: false } as unknown as ReturnType<typeof useChatMessagesQuery>)
    rerender(<ChatPanel incidentId="incident-1" filter="comments" />)
    expect(screen.queryByText('Incident created')).not.toBeInTheDocument()
    expect(screen.getByText('A real comment')).toBeInTheDocument()
  })
})
