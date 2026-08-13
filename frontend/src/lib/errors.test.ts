import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { getErrorMessage, getErrorCode } from './errors'

function makeAxiosError(opts: { data?: unknown; code?: string; message?: string }): AxiosError {
  const err = new AxiosError(opts.message ?? 'Request failed')
  if (opts.code) err.code = opts.code
  if (opts.data !== undefined) {
    err.response = { data: opts.data, status: 400, statusText: 'Bad Request', headers: {}, config: {} as never }
  }
  return err
}

describe('getErrorMessage', () => {
  it('extracts the server message from an axios error response', () => {
    const err = makeAxiosError({ data: { message: 'Email already in use' } })
    expect(getErrorMessage(err)).toBe('Email already in use')
  })

  it('returns a friendly network message for ERR_NETWORK with no response', () => {
    const err = makeAxiosError({ code: 'ERR_NETWORK' })
    expect(getErrorMessage(err)).toBe('Could not reach the server. Is the backend running?')
  })

  it('falls back to the axios error message when there is no server message and no network code', () => {
    const err = makeAxiosError({ message: 'timeout of 5000ms exceeded' })
    expect(getErrorMessage(err)).toBe('timeout of 5000ms exceeded')
  })

  it('falls back to the axios error message when response data has no message field', () => {
    const err = makeAxiosError({ data: { status: 500 }, message: 'Request failed with status code 500' })
    expect(getErrorMessage(err)).toBe('Request failed with status code 500')
  })

  it('returns a plain Error message for a non-axios Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns a generic fallback for a totally unknown thrown value', () => {
    expect(getErrorMessage('a string was thrown')).toBe('Something went wrong')
    expect(getErrorMessage(null)).toBe('Something went wrong')
    expect(getErrorMessage(undefined)).toBe('Something went wrong')
    expect(getErrorMessage(42)).toBe('Something went wrong')
  })
})

describe('getErrorCode', () => {
  it('extracts a machine-readable code from an axios error response', () => {
    const err = makeAxiosError({ data: { code: 'MEMBERSHIP_INACTIVE' } })
    expect(getErrorCode(err)).toBe('MEMBERSHIP_INACTIVE')
  })

  it('returns null when the response data has no code', () => {
    const err = makeAxiosError({ data: { message: 'oops' } })
    expect(getErrorCode(err)).toBeNull()
  })

  it('returns null when there is no response at all', () => {
    const err = makeAxiosError({})
    expect(getErrorCode(err)).toBeNull()
  })

  it('returns null for a non-axios error', () => {
    expect(getErrorCode(new Error('boom'))).toBeNull()
    expect(getErrorCode('nope')).toBeNull()
  })
})
