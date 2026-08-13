import axios, { AxiosError, isAxiosError, type InternalAxiosRequestConfig } from 'axios'
import { store } from '@/app/store'
import { queryClient } from '@/app/queryClient'
import { setTokens, clearSession } from '@/features/session/sessionSlice'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

apiClient.interceptors.request.use((config) => {
  const { token } = store.getState().session
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

// A silent refresh triggered by one failed request must not race a second refresh
// triggered by another request that failed at the same time — every 401 while a
// refresh is already in flight waits on this same promise instead of firing its own.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const { refreshToken } = store.getState().session
  if (!refreshToken) throw new Error('no refresh token')

  // A fresh axios call, not apiClient — going through apiClient's own response
  // interceptor here would recurse back into this same refresh flow on a 401.
  const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`, {
    refreshToken,
  })
  const { token, refreshToken: newRefreshToken } = response.data as { token: string; refreshToken: string }
  store.dispatch(setTokens({ token, refreshToken: newRefreshToken }))
  return token
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const isAuthEndpoint = original?.url?.includes('/api/auth/login')
      || original?.url?.includes('/api/auth/register')
      || original?.url?.includes('/api/auth/refresh')

    if (error.response?.status !== 401 || !original || original._retried || isAuthEndpoint) {
      throw error
    }
    original._retried = true

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const token = await refreshPromise
      original.headers.set('Authorization', `Bearer ${token}`)
      return await apiClient.request(original)
    } catch (refreshError) {
      store.dispatch(clearSession())
      queryClient.clear()
      // MEMBERSHIP_INACTIVE means the refresh token itself was fine but the membership
      // it's pinned to changed (removed/suspended) — distinct from a plain expired
      // session, so LoginPage can show a more specific message. Both cases end the same
      // way otherwise: no auto-switch is possible here, since the access token is
      // already expired by the time a refresh is attempted (see Frontend item 18).
      const code = isAxiosError(refreshError)
        ? (refreshError.response?.data as { code?: string } | undefined)?.code
        : undefined
      window.location.assign(code === 'MEMBERSHIP_INACTIVE' ? '/login?reason=membership_inactive' : '/login')
      throw error
    }
  },
)
