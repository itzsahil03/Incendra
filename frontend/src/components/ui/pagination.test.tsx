import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from './pagination'

describe('Pagination', () => {
  it('renders nav with navigation role and pagination aria-label', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#">1</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
    const nav = screen.getByRole('navigation', { name: 'pagination' })
    expect(nav).toHaveAttribute('data-slot', 'pagination')
  })

  it('marks the active page link with aria-current and data-active', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              2
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
    const link = screen.getByText('2')
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link).toHaveAttribute('data-active', 'true')
  })

  it('inactive link has no aria-current or data-active attribute', () => {
    render(<PaginationLink href="#">3</PaginationLink>)
    const link = screen.getByText('3')
    expect(link).not.toHaveAttribute('aria-current')
    expect(link).not.toHaveAttribute('data-active')
  })

  it('renders Previous and Next links with icons and labels, responding to clicks', async () => {
    const user = userEvent.setup()
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" onClick={onPrevious} />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" onClick={onNext} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
    const prev = screen.getByRole('link', { name: /go to previous page/i })
    const next = screen.getByRole('link', { name: /go to next page/i })
    await user.click(prev)
    await user.click(next)
    expect(onPrevious).toHaveBeenCalled()
    expect(onNext).toHaveBeenCalled()
  })

  it('renders ellipsis with sr-only text and aria-hidden', () => {
    render(<PaginationEllipsis />)
    expect(screen.getByText('More pages')).toBeInTheDocument()
    const ellipsis = screen.getByText('More pages').parentElement
    expect(ellipsis).toHaveAttribute('aria-hidden')
  })

  it('merges custom className on PaginationContent and Pagination', () => {
    render(
      <Pagination className="custom-pagination">
        <PaginationContent className="custom-content" data-testid="content" />
      </Pagination>
    )
    expect(screen.getByTestId('content')).toHaveClass('custom-content')
    expect(screen.getByRole('navigation')).toHaveClass('custom-pagination')
  })
})
