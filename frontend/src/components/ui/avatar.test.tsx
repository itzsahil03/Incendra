import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from './avatar'

describe('Avatar', () => {
  it('renders fallback text since jsdom never loads the image', () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarImage src="https://example.com/avatar.png" alt="user" />
        <AvatarFallback>JS</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-slot', 'avatar')
    expect(screen.getByText('JS')).toHaveAttribute('data-slot', 'avatar-fallback')
  })

  it('applies default size data attribute', () => {
    render(<Avatar data-testid="avatar" />)
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-size', 'default')
  })

  it.each(['default', 'sm', 'lg'] as const)('applies the %s size', (size) => {
    render(<Avatar data-testid="avatar" size={size} />)
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-size', size)
  })

  it('renders an AvatarBadge as a sibling element', () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarFallback>AB</AvatarFallback>
        <AvatarBadge data-testid="badge" />
      </Avatar>
    )
    expect(screen.getByTestId('badge')).toHaveAttribute('data-slot', 'avatar-badge')
  })

  it('renders AvatarGroup with nested avatars and a count', () => {
    render(
      <AvatarGroup data-testid="group">
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
        <AvatarGroupCount data-testid="count">+3</AvatarGroupCount>
      </AvatarGroup>
    )
    expect(screen.getByTestId('group')).toHaveAttribute('data-slot', 'avatar-group')
    expect(screen.getByTestId('count')).toHaveAttribute('data-slot', 'avatar-group-count')
    expect(screen.getByText('+3')).toBeInTheDocument()
  })

  it('merges custom className on Avatar', () => {
    render(<Avatar data-testid="avatar" className="custom-avatar" />)
    expect(screen.getByTestId('avatar')).toHaveClass('custom-avatar')
  })
})
