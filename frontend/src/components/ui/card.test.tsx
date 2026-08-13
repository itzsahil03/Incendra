import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from './card'

describe('Card', () => {
  it('renders all sub-components with their content and data-slot attributes', () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="header">
          <CardTitle>Incident #123</CardTitle>
          <CardDescription>Server down</CardDescription>
          <CardAction data-testid="action">Action</CardAction>
        </CardHeader>
        <CardContent data-testid="content">Body content</CardContent>
        <CardFooter data-testid="footer">Footer content</CardFooter>
      </Card>
    )

    expect(screen.getByTestId('card')).toHaveAttribute('data-slot', 'card')
    expect(screen.getByTestId('header')).toHaveAttribute('data-slot', 'card-header')
    expect(screen.getByText('Incident #123')).toHaveAttribute('data-slot', 'card-title')
    expect(screen.getByText('Server down')).toHaveAttribute('data-slot', 'card-description')
    expect(screen.getByTestId('action')).toHaveAttribute('data-slot', 'card-action')
    expect(screen.getByTestId('content')).toHaveAttribute('data-slot', 'card-content')
    expect(screen.getByTestId('footer')).toHaveAttribute('data-slot', 'card-footer')
  })

  it('merges custom className with default classes on Card', () => {
    render(<Card data-testid="card" className="custom-class" />)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('custom-class')
    expect(card).toHaveClass('rounded-xl')
  })

  it('forwards arbitrary props to the underlying div', () => {
    render(<Card data-testid="card" aria-label="incident card" />)
    expect(screen.getByTestId('card')).toHaveAttribute('aria-label', 'incident card')
  })
})
