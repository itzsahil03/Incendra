import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// RTL doesn't auto-unmount between tests outside of Jest's global afterEach —
// without this, a component left mounted by one test can leak DOM nodes/timers
// into the next test's queries.
afterEach(() => {
  cleanup()
})

// jsdom has neither of these — framer-motion's `whileInView` (used by the marketing
// site's <FadeIn>) needs IntersectionObserver at mount time, and <video>'s .play() has
// no jsdom implementation at all (throws "not implemented"). Both are used widely enough
// across public pages that stubbing them once here beats repeating it per test file.
if (!('IntersectionObserver' in globalThis)) {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  // @ts-expect-error -- partial polyfill, sufficient for framer-motion's usage
  globalThis.IntersectionObserver = MockIntersectionObserver
}
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
  HTMLMediaElement.prototype.pause = vi.fn(() => {})
}
