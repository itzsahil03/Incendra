import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table'

describe('Table', () => {
  it('renders a full table structure with header, body, footer and caption', () => {
    render(
      <Table data-testid="table">
        <TableCaption>Incident list</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Server down</TableCell>
            <TableCell>Open</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>1</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    expect(screen.getByTestId('table')).toHaveAttribute('data-slot', 'table')
    expect(screen.getByText('Incident list')).toHaveAttribute('data-slot', 'table-caption')
    expect(screen.getByText('Name')).toHaveAttribute('data-slot', 'table-head')
    expect(screen.getByText('Server down')).toHaveAttribute('data-slot', 'table-cell')
    expect(screen.getByText('Total')).toHaveAttribute('data-slot', 'table-cell')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('wraps the table in a scroll container', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    const wrapper = container.querySelector('[data-slot="table-container"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).toHaveClass('overflow-x-auto')
  })

  it('merges custom className on TableRow', () => {
    render(
      <table>
        <tbody>
          <TableRow data-testid="row" className="custom-row">
            <TableCell>x</TableCell>
          </TableRow>
        </tbody>
      </table>
    )
    expect(screen.getByTestId('row')).toHaveClass('custom-row')
    expect(screen.getByTestId('row')).toHaveClass('border-b')
  })
})
