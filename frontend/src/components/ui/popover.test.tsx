import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from './popover'

beforeAll(() => {
  Element.prototype.hasPointerCapture = (() =>
    false) as unknown as typeof Element.prototype.hasPointerCapture
  Element.prototype.setPointerCapture = (() => {}) as unknown as typeof Element.prototype.setPointerCapture
  Element.prototype.releasePointerCapture = (() => {}) as unknown as typeof Element.prototype.releasePointerCapture
  Element.prototype.scrollIntoView = () => {}
})

describe('Popover', () => {
  it('opens content on trigger click and closes on second click', async () => {
    const user = userEvent.setup()
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>Title</PopoverTitle>
            <PopoverDescription>Description</PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    )

    expect(screen.queryByText('Title')).not.toBeInTheDocument()

    await user.click(screen.getByText('Open'))
    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument()
    })
    expect(screen.getByText('Description')).toBeInTheDocument()

    await user.click(screen.getByText('Open'))
    await waitFor(() => {
      expect(screen.queryByText('Title')).not.toBeInTheDocument()
    })
  })

  it('supports defaultOpen for uncontrolled initial state', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Visible by default</PopoverContent>
      </Popover>
    )
    expect(screen.getByText('Visible by default')).toBeInTheDocument()
  })

  it('renders PopoverAnchor without affecting trigger/content relationship', async () => {
    const user = userEvent.setup()
    render(
      <Popover>
        <PopoverAnchor data-testid="anchor" />
        <PopoverTrigger>Anchor Open</PopoverTrigger>
        <PopoverContent>Anchored content</PopoverContent>
      </Popover>
    )
    expect(screen.getByTestId('anchor')).toHaveAttribute('data-slot', 'popover-anchor')
    await user.click(screen.getByText('Anchor Open'))
    await waitFor(() => {
      expect(screen.getByText('Anchored content')).toBeInTheDocument()
    })
  })

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Escapable content</PopoverContent>
      </Popover>
    )
    await user.click(screen.getByText('Open'))
    await waitFor(() => {
      expect(screen.getByText('Escapable content')).toBeInTheDocument()
    })
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByText('Escapable content')).not.toBeInTheDocument()
    })
  })
})
