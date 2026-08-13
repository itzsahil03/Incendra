import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './dropdown-menu'

beforeAll(stubRadixEnvironment)

function FullMenu({ onSelect }: { onSelect?: (v: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onSelect?.('edit')}>
            Edit
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onSelect?.('delete')}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked onCheckedChange={() => onSelect?.('toggle')}>
          Show archived
        </DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup value="a" onValueChange={(v) => onSelect?.(`radio:${v}`)}>
          <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="b">Option B</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onSelect?.('nested')}>Nested action</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('DropdownMenu — full composition', () => {
  it('opens and lists grouped items, a checkbox item, and a radio group', async () => {
    const user = userEvent.setup()
    render(<FullMenu />)
    await user.click(screen.getByText('Open menu'))
    expect(await screen.findByText('Actions')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('⌘E')).toBeInTheDocument()
    expect(screen.getByRole('menuitemcheckbox', { name: 'Show archived' })).toHaveAttribute('data-state', 'checked')
    expect(screen.getByRole('menuitemradio', { name: 'Option A' })).toHaveAttribute('data-state', 'checked')
  })

  it('fires onClick for a regular item and closes the menu', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<FullMenu onSelect={onSelect} />)
    await user.click(screen.getByText('Open menu'))
    await user.click(await screen.findByText('Edit'))
    expect(onSelect).toHaveBeenCalledWith('edit')
  })

  it('marks the destructive item with the destructive data-variant', async () => {
    const user = userEvent.setup()
    render(<FullMenu />)
    await user.click(screen.getByText('Open menu'))
    expect(await screen.findByText('Delete')).toHaveAttribute('data-variant', 'destructive')
  })

  it('toggles a checkbox item', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<FullMenu onSelect={onSelect} />)
    await user.click(screen.getByText('Open menu'))
    await user.click(await screen.findByText('Show archived'))
    expect(onSelect).toHaveBeenCalledWith('toggle')
  })

  it('selects a radio item', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<FullMenu onSelect={onSelect} />)
    await user.click(screen.getByText('Open menu'))
    await user.click(await screen.findByText('Option B'))
    expect(onSelect).toHaveBeenCalledWith('radio:b')
  })

  it('opens a submenu via keyboard and fires its item action', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<FullMenu onSelect={onSelect} />)
    await user.click(screen.getByText('Open menu'))
    const subTrigger = await screen.findByText('More')
    subTrigger.focus()
    await user.keyboard('{ArrowRight}')
    const nested = await screen.findByText('Nested action')
    await user.click(nested)
    expect(onSelect).toHaveBeenCalledWith('nested')
  })
})
