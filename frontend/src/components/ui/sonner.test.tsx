import { describe, it, expect, beforeAll } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { Toaster } from './sonner'

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList)
})

describe('Toaster (sonner)', () => {
  // sonner portals the toaster <section> to document.body, so it never shows up inside
  // RTL's render() container — query the document instead. The inner <ol data-sonner-toaster>
  // only mounts once at least one toast exists (sonner returns null for an empty toast list),
  // so every test below pushes a toast first rather than asserting on a static empty Toaster.
  it('renders the aria-live notifications region immediately, even with no toasts yet', () => {
    render(<Toaster />)
    expect(document.querySelector('section[aria-label^="Notifications"]')).toBeInTheDocument()
  })

  it('resolves the default system theme via matchMedia once a toast is pushed', async () => {
    // "system" isn't a literal DOM value — sonner resolves it against
    // matchMedia('(prefers-color-scheme: dark)'), which our stub always reports as not
    // matching, so it resolves to "light".
    render(<Toaster />)
    act(() => {
      toast('Hello')
    })
    await waitFor(() => {
      expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute('data-sonner-theme', 'light')
    })
  })

  it('accepts an explicit theme prop', async () => {
    render(<Toaster theme="dark" />)
    act(() => {
      toast('Hello')
    })
    await waitFor(() => {
      expect(document.querySelector('[data-sonner-toaster]')).toHaveAttribute('data-sonner-theme', 'dark')
    })
  })

  it('forwards additional props such as position', async () => {
    render(<Toaster position="top-center" />)
    act(() => {
      toast('Hello')
    })
    await waitFor(() => {
      const toaster = document.querySelector('[data-sonner-toaster]')
      expect(toaster).toBeInTheDocument()
      expect(toaster).toHaveAttribute('data-x-position', 'center')
    })
  })
})
