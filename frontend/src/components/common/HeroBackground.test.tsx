import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { HeroBackground } from './HeroBackground'

describe('HeroBackground', () => {
  beforeEach(() => {
    // jsdom's HTMLMediaElement has no real playback implementation.
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  })

  it('renders a background video element', () => {
    const { container } = render(<HeroBackground />)
    expect(container.querySelector('video')).toBeInTheDocument()
  })

  it('applies the page overlay gradient by default', () => {
    const { container } = render(<HeroBackground />)
    const overlay = container.querySelector('video')!.nextElementSibling as HTMLElement
    expect(overlay.style.background).toContain('180deg')
    expect(overlay.style.background).toContain('rgba(0, 0, 0, 0.75)')
  })

  it('applies a different overlay when specified', () => {
    const { container } = render(<HeroBackground overlay="app" />)
    const overlay = container.querySelector('video')!.nextElementSibling as HTMLElement
    expect(overlay.style.background).toContain('105deg')
  })

  it('applies a custom videoOpacity to the video element', () => {
    const { container } = render(<HeroBackground videoOpacity={0.5} />)
    const video = container.querySelector('video') as HTMLElement
    expect(video.style.opacity).toBe('0.5')
  })

  it('attempts to play the video on mount', () => {
    render(<HeroBackground />)
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })
})
