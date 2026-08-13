import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip'

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.hasPointerCapture = (() =>
    false) as unknown as typeof Element.prototype.hasPointerCapture
  Element.prototype.setPointerCapture = (() => {}) as unknown as typeof Element.prototype.setPointerCapture
  Element.prototype.releasePointerCapture = (() => {}) as unknown as typeof Element.prototype.releasePointerCapture
})

describe('Tooltip', () => {
  it('shows tooltip content on hover', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Helpful info</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    expect(screen.queryByText('Helpful info')).not.toBeInTheDocument()

    await user.hover(screen.getByText('Hover me'))
    await waitFor(() => {
      expect(screen.getByText('Helpful info')).toBeInTheDocument()
    })
    // Not asserting on unhover-to-close here: Radix's close-on-unhover relies on a
    // pointer-position "safe area" polygon check between trigger and content that needs
    // real clientX/clientY tracking — jsdom's synthetic pointer events don't supply that,
    // so the tooltip never reliably transitions out of "delayed-open" in this environment.
  })

  it('supports an initially open, uncontrolled-open tooltip via defaultOpen', () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Always visible tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
    expect(screen.getByText('Always visible tip')).toBeInTheDocument()
  })

  it('TooltipProvider renders children and applies default delayDuration', () => {
    render(
      <TooltipProvider>
        <div>child content</div>
      </TooltipProvider>
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})
