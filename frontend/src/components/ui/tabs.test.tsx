import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'

function ThreeTabs(props: { defaultValue?: string; onValueChange?: (v: string) => void }) {
  return (
    <Tabs defaultValue={props.defaultValue ?? 'one'} onValueChange={props.onValueChange}>
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
        <TabsTrigger value="three" disabled>
          Three
        </TabsTrigger>
      </TabsList>
      <TabsContent value="one">Content One</TabsContent>
      <TabsContent value="two">Content Two</TabsContent>
      <TabsContent value="three">Content Three</TabsContent>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('renders the default tab content and switches on trigger click', async () => {
    const user = userEvent.setup()
    render(<ThreeTabs />)

    expect(screen.getByText('Content One')).toBeInTheDocument()
    expect(screen.queryByText('Content Two')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Two' }))
    expect(screen.getByText('Content Two')).toBeInTheDocument()
    expect(screen.queryByText('Content One')).not.toBeInTheDocument()
  })

  it('calls onValueChange when switching tabs', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<ThreeTabs onValueChange={onValueChange} />)
    await user.click(screen.getByRole('tab', { name: 'Two' }))
    expect(onValueChange).toHaveBeenCalledWith('two')
  })

  it('does not activate a disabled tab', async () => {
    const user = userEvent.setup()
    render(<ThreeTabs />)
    const disabledTab = screen.getByRole('tab', { name: 'Three' })
    expect(disabledTab).toBeDisabled()
    await user.click(disabledTab)
    expect(screen.queryByText('Content Three')).not.toBeInTheDocument()
  })

  it('supports keyboard navigation with arrow keys between tabs', async () => {
    const user = userEvent.setup()
    render(<ThreeTabs />)
    const firstTab = screen.getByRole('tab', { name: 'One' })
    firstTab.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus()
  })

  it('renders horizontal orientation by default and applies data-orientation', () => {
    render(<ThreeTabs />)
    const tabsRoot = screen.getByRole('tablist').parentElement
    expect(tabsRoot).toHaveAttribute('data-orientation', 'horizontal')
  })

  it('supports the line variant on TabsList', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList variant="line">
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">A content</TabsContent>
      </Tabs>
    )
    expect(screen.getByRole('tablist')).toHaveAttribute('data-variant', 'line')
  })
})
