import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/** Mirrors auth-service's UserSummaryResponse/UserAccountResponse role field — a plain
 *  uppercase string ("ADMIN" | "RESPONDER" | "VIEWER"), not a TS union enforced against
 *  the server, since the backend itself only lenient-parses it (see common's Role.parse). */
export type Role = 'ADMIN' | 'RESPONDER' | 'VIEWER'

export interface SessionUser {
  id: string
  email: string
  name: string
  /** Null when the account currently has zero ACTIVE memberships anywhere (just left
   *  their last org, or a brand-new/legacy account with none) — the "zero organizations"
   *  state. Never a stand-in for "not logged in"; `user` itself is null for that. */
  orgId: string | null
  role: Role | null
}

export interface SessionState {
  token: string | null
  /** Null both when logged out AND when logged in with zero ACTIVE memberships (see
   *  SessionUser.orgId) — in the latter case `token`/`user` stay set so the still-valid
   *  access token can authorize the zero-org bootstrap "Create organization" call. */
  refreshToken: string | null
  user: SessionUser | null
}

const STORAGE_KEY = 'incidentops.session'

function loadInitialState(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as SessionState
  } catch {
    // corrupt/blocked storage — fall through to a logged-out default
  }
  return { token: null, refreshToken: null, user: null }
}

const sessionSlice = createSlice({
  name: 'session',
  initialState: loadInitialState(),
  reducers: {
    setSession(state, action: PayloadAction<{ token: string; refreshToken: string | null; user: SessionUser }>) {
      state.token = action.payload.token
      state.refreshToken = action.payload.refreshToken
      state.user = action.payload.user
    },
    /** Silent refresh only rotates the tokens — the user object doesn't come back from
     *  /api/auth/refresh's own response is actually included (AuthResponse always
     *  carries `user`), but this setter is kept separate for the case a caller only has
     *  fresh tokens in hand. */
    setTokens(state, action: PayloadAction<{ token: string; refreshToken: string }>) {
      state.token = action.payload.token
      state.refreshToken = action.payload.refreshToken
    },
    updateUserRole(state, action: PayloadAction<Role>) {
      if (state.user) state.user.role = action.payload
    },
    /** Used only for leaveOrganization()'s "zero remaining orgs" response — nulls just
     *  the refresh token, deliberately keeping the still-valid access token (and user)
     *  in place. See Backend item 9.5: the access token is what authorizes the zero-org
     *  bootstrap "Create organization" call; a full clearSession() here would break it. */
    clearRefreshToken(state) {
      state.refreshToken = null
      if (state.user) {
        state.user.orgId = null
        state.user.role = null
      }
    },
    clearSession(state) {
      state.token = null
      state.refreshToken = null
      state.user = null
    },
  },
})

export const { setSession, setTokens, updateUserRole, clearRefreshToken, clearSession } = sessionSlice.actions
export default sessionSlice.reducer
