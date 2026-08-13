import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, SheetClose } from './sheet'

beforeAll(stubRadixEnvironment)

describe('Sheet', () => {
  it('opens via SheetTrigger and shows header/description/footer content', async () => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Refine the list below.</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose>Done</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    )
    await user.click(screen.getByText('Open'))
    expect(await screen.findByText('Filters')).toBeInTheDocument()
    expect(screen.getByText('Refine the list below.')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('closes via SheetClose', async () => {
    const user = userEvent.setup()
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Filters</SheetTitle>
          <SheetClose>Close it</SheetClose>
        </SheetContent>
      </Sheet>,
    )
    expect(screen.getByText('Filters')).toBeInTheDocument()
    await user.click(screen.getByText('Close it'))
    expect(screen.queryByText('Filters')).not.toBeInTheDocument()
  })

  it('renders the default close (X) button unless showCloseButton is false', async () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    )
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('omits the close button when showCloseButton is false', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent showCloseButton={false}>
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    )
    expect(screen.queryByText('Close')).not.toBeInTheDocument()
  })

  it.each(['top', 'bottom', 'left', 'right'] as const)('renders the %s side variant', (side) => {
    render(
      <Sheet defaultOpen>
        <SheetContent side={side}>
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    )
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('calls onOpenChange when toggled', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Sheet onOpenChange={onOpenChange}>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    )
    await user.click(screen.getByText('Open'))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })
})
