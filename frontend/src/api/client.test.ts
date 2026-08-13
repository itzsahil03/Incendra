import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'

const mockGetState = vi.fn()
const mockDispatch = vi.fn()

vi.mock('@/app/store', () => ({
  store: {
    getState: () => mockGetState(),
    dispatch: (action: unknown) => mockDispatch(action),
  },
}))

const mockQueryClientClear = vi.fn()
vi.mock('@/app/queryClient', () => ({
  queryClient: { clear: mockQueryClientClear },
}))

// Imported after the mocks above so client.ts picks up the mocked modules.
const { apiClient } = await import('./client')

/** client.ts's interceptor is registered on `apiClient.interceptors.response` at
 *  import time — grabbing the handler directly (rather than driving a real network
 *  call through jsdom) is the practical way to unit-test it in isolation. */
function rejectedHandler() {
  const manager = apiClient.interceptors.response as unknown as {
    handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>
  }
  return manager.handlers[0].rejected
}

describe('apiClient response interceptor', () => {
  // jsdom's window.location.assign isn't configurable, so vi.spyOn can't wrap it
  // directly — replacing the whole `location` object is the standard workaround.
  const assignSpy = vi.fn()
  Object.defineProperty(window, 'location', { writable: true, value: { assign: assignSpy } })

  beforeEach(() => {
    mockGetState.mockReturnValue({ session: { token: 'old-token', refreshToken: 'old-refresh' } })
    mockDispatch.mockClear()
    mockQueryClientClear.mockClear()
    assignSpy.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes through a non-401 error unchanged, without attempting a refresh', async () => {
    const postSpy = vi.spyOn(axios, 'post')
    const error = { response: { status: 500 }, config: { url: '/api/incidents' } }

    await expect(rejectedHandler()(error)).rejects.toBe(error)
    expect(postSpy).not.toHaveBeenCalled()
  })

  it('does not attempt a refresh for a 401 from the login endpoint itself', async () => {
    const postSpy = vi.spyOn(axios, 'post')
    const error = { response: { status: 401 }, config: { url: '/api/auth/login' } }

    await expect(rejectedHandler()(error)).rejects.toBe(error)
    expect(postSpy).not.toHaveBeenCalled()
  })

  it('on a 401, refreshes the token and retries the original request once', async () => {
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { token: 'new-token', refreshToken: 'new-refresh' },
    })
    const retryResponse = { data: { ok: true } }
    vi.spyOn(apiClient, 'request').mockResolvedValueOnce(retryResponse)

    const headers = { set: vi.fn() }
    const config = { url: '/api/incidents', headers }
    const error = { response: { status: 401 }, config }

    const result = await rejectedHandler()(error)

    expect(result).toBe(retryResponse)
    expect(headers.set).toHaveBeenCalledWith('Authorization', 'Bearer new-token')
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { token: 'new-token', refreshToken: 'new-refresh' } }),
    )
  })

  it('clears the session and redirects to /login when the refresh call itself fails', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce({ isAxiosError: true, response: { data: {} } })
    const error = { response: { status: 401 }, config: { url: '/api/incidents', headers: { set: vi.fn() } } }

    await expect(rejectedHandler()(error)).rejects.toBe(error)

    expect(mockQueryClientClear).toHaveBeenCalled()
    expect(assignSpy).toHaveBeenCalledWith('/login')
  })

  it('redirects with the membership_inactive reason when the refresh failure carries that code', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { code: 'MEMBERSHIP_INACTIVE' } },
    })
    const error = { response: { status: 401 }, config: { url: '/api/incidents', headers: { set: vi.fn() } } }

    await expect(rejectedHandler()(error)).rejects.toBe(error)

    expect(assignSpy).toHaveBeenCalledWith('/login?reason=membership_inactive')
  })

  it('does not retry a request that has already been retried once', async () => {
    const postSpy = vi.spyOn(axios, 'post')
    const error = {
      response: { status: 401 },
      config: { url: '/api/incidents', headers: { set: vi.fn() }, _retried: true },
    }

    await expect(rejectedHandler()(error)).rejects.toBe(error)
    expect(postSpy).not.toHaveBeenCalled()
  })
})
