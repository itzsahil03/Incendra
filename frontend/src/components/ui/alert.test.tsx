import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Alert, AlertTitle, AlertDescription } from './alert'

describe('Alert', () => {
  it('renders with role alert and default variant', () => {
    render(
      <Alert data-testid="alert">
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Something happened</AlertDescription>
      </Alert>
    )
    const alert = screen.getByRole('alert')
    expect(alert).toBe(screen.getByTestId('alert'))
    expect(alert).toHaveAttribute('data-slot', 'alert')
    expect(screen.getByText('Heads up')).toHaveAttribute('data-slot', 'alert-title')
    expect(screen.getByText('Something happened')).toHaveAttribute(
      'data-slot',
      'alert-description'
    )
  })

  it('applies destructive variant classes', () => {
    render(<Alert data-testid="alert" variant="destructive" />)
    expect(screen.getByTestId('alert')).toHaveClass('text-destructive')
  })

  it('applies default variant classes when variant omitted', () => {
    render(<Alert data-testid="alert" />)
    expect(screen.getByTestId('alert')).toHaveClass('bg-card')
  })

  it('merges custom className', () => {
    render(<Alert data-testid="alert" className="custom-alert" />)
    expect(screen.getByTestId('alert')).toHaveClass('custom-alert')
  })
})
