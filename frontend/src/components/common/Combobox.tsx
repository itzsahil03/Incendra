import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  id: string
  label: string
}

/** Generic searchable single-select dropdown (Popover + Command) — the shadcn/Radix
 *  replacement for MUI's `Autocomplete` used throughout the app for assignee pickers,
 *  incident/alert filters, etc. `renderOption`/`renderValue` let callers show an avatar
 *  next to the label without this component knowing about avatars itself. */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  renderOption,
  renderValue,
  disabled,
  className,
  triggerClassName,
}: {
  options: ComboboxOption[]
  value: string | null | undefined
  onChange: (id: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  renderOption?: (option: ComboboxOption) => ReactNode
  renderValue?: (option: ComboboxOption) => ReactNode
  disabled?: boolean
  className?: string
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', triggerClassName)}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder}
          </span>
          <ChevronsUpDown className="ml-1 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[--radix-popover-trigger-width] p-0', className)} align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-4', option.id === value ? 'opacity-100' : 'opacity-0')} />
                  {renderOption ? renderOption(option) : option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
