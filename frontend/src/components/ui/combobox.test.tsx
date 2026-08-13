import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { stubRadixEnvironment } from '@/test/renderWithProviders'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxValue,
  useComboboxAnchor,
} from './combobox'

beforeAll(stubRadixEnvironment)

const FRUITS = ['Apple', 'Banana', 'Cherry']

function BasicCombobox({ onValueChange }: { onValueChange?: (v: string | null) => void }) {
  return (
    <Combobox items={FRUITS} onValueChange={onValueChange}>
      <ComboboxValue />
      <ComboboxInput placeholder="Pick a fruit" />
      <ComboboxContent>
        <ComboboxEmpty>No fruit found.</ComboboxEmpty>
        <ComboboxList>
          <ComboboxGroup>
            <ComboboxLabel>Fruits</ComboboxLabel>
            <ComboboxCollection>
              {(item: string) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}
            </ComboboxCollection>
          </ComboboxGroup>
          <ComboboxSeparator />
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function ChipsCombobox() {
  const anchor = useComboboxAnchor()
  return (
    <Combobox items={FRUITS} multiple defaultValue={['Apple']}>
      <ComboboxChips ref={anchor as never}>
        <ComboboxValue>
          {(value: string[]) => value.map((v) => <ComboboxChip key={v}>{v}</ComboboxChip>)}
        </ComboboxValue>
        <ComboboxChipsInput placeholder="Add fruit" />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxList>
          <ComboboxCollection>
            {(item: string) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

describe('Combobox — single select', () => {
  it('opens the popup on input click and lists items grouped under a label', async () => {
    const user = userEvent.setup()
    render(<BasicCombobox />)
    await user.click(screen.getByPlaceholderText('Pick a fruit'))
    expect(await screen.findByText('Fruits')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
  })

  it('selects an item and reports the new value', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<BasicCombobox onValueChange={onValueChange} />)
    await user.click(screen.getByPlaceholderText('Pick a fruit'))
    await user.click(await screen.findByText('Banana'))
    expect(onValueChange).toHaveBeenCalledWith('Banana', expect.anything())
  })

  it('filters items as the user types and shows the empty state for no match', async () => {
    const user = userEvent.setup()
    render(<BasicCombobox />)
    const input = screen.getByPlaceholderText('Pick a fruit')
    await user.click(input)
    await user.type(input, 'zzz')
    expect(await screen.findByText('No fruit found.')).toBeInTheDocument()
  })
})

describe('Combobox — chips (multiple)', () => {
  it('renders a chip for the pre-selected value with a remove control', async () => {
    render(<ChipsCombobox />)
    expect(screen.getByText('Apple')).toBeInTheDocument()
    const chip = screen.getByText('Apple').closest('[data-slot="combobox-chip"]') as HTMLElement
    expect(within(chip).getByRole('button')).toBeInTheDocument()
  })

  it('removes a chip when its remove button is clicked', async () => {
    const user = userEvent.setup()
    render(<ChipsCombobox />)
    const chip = screen.getByText('Apple').closest('[data-slot="combobox-chip"]') as HTMLElement
    await user.click(within(chip).getByRole('button'))
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
  })
})
