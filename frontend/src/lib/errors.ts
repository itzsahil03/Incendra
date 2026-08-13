import { isAxiosError } from 'axios'

/** Every backend error response is the shared {timestamp,status,error,message,path}
 *  shape (common's BaseExceptionHandler) — this pulls the human-readable `message`
 *  out of it, falling back gracefully for network errors or anything unexpected. */
export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    if (data?.message) return data.message
    if (error.code === 'ERR_NETWORK') return 'Could not reach the server. Is the backend running?'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

/** Pulls the optional machine-readable `code` out of an error response (e.g.
 *  MEMBERSHIP_INACTIVE, ALREADY_ORG_MEMBER, LAST_ADMIN) — null for the large majority
 *  of errors that don't carry one. Use this to branch on specific error semantics;
 *  use getErrorMessage for display text. */
export function getErrorCode(error: unknown): string | null {
  if (isAxiosError(error)) {
    const data = error.response?.data as { code?: string } | undefined
    return data?.code ?? null
  }
  return null
}
