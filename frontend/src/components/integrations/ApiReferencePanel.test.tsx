import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { ApiReferencePanel } from './ApiReferencePanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false) as unknown as typeof Element.prototype.hasPointerCapture
  Element.prototype.scrollIntoView = vi.fn()
})

describe('ApiReferencePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const endpoints = [
    { method: 'GET', path: '/api/incidents', description: 'List incidents' },
    { method: 'POST', path: '/api/incidents' },
  ]
  const headers = [{ name: 'Authorization', value: 'Bearer <token>' }]
  const curlExample = 'curl -X GET https://api.incendra.dev/api/incidents'

  it('shows the trigger button and keeps the panel content closed initially', () => {
    render(<ApiReferencePanel endpoints={endpoints} headers={headers} curlExample={curlExample} />)
    expect(screen.getByRole('button', { name: /api reference/i })).toBeInTheDocument()
    expect(screen.queryByText('/api/incidents')).not.toBeInTheDocument()
  })

  it('opens the panel and shows endpoints, headers, and the curl example', async () => {
    const user = userEvent.setup()
    render(<ApiReferencePanel endpoints={endpoints} headers={headers} curlExample={curlExample} />)
    await user.click(screen.getByRole('button', { name: /api reference/i }))

    expect(await screen.findAllByText('/api/incidents')).toHaveLength(2)
    expect(screen.getByText('List incidents')).toBeInTheDocument()
    expect(screen.getByText('GET')).toBeInTheDocument()
    expect(screen.getByText('POST')).toBeInTheDocument()
    expect(screen.getByText('Authorization:')).toBeInTheDocument()
    expect(screen.getByText('Bearer <token>')).toBeInTheDocument()
    expect(screen.getByText(curlExample)).toBeInTheDocument()
  })

  it('copies the curl example to the clipboard when the copy icon button is clicked', async () => {
    // userEvent.setup() installs its own emulated navigator.clipboard (overwriting any
    // custom mock defined beforehand) — so verify through that real emulation via
    // readText() rather than trying to out-mock it.
    const user = userEvent.setup()
    render(<ApiReferencePanel endpoints={endpoints} headers={headers} curlExample={curlExample} />)
    await user.click(screen.getByRole('button', { name: /api reference/i }))
    await user.click(await screen.findByRole('button', { name: 'Copy example' }))
    await expect(navigator.clipboard.readText()).resolves.toBe(curlExample)
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard')
  })
})
