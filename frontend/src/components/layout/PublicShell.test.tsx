import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import sessionReducer from '@/features/session/sessionSlice'
import { PublicShell } from './PublicShell'

function renderShell() {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session: { token: null, refreshToken: null, user: null } },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicShell />}>
            <Route index element={<div>Home content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

describe('PublicShell', () => {
  it('renders the header, the routed outlet content, and the footer', () => {
    renderShell()
    expect(screen.getAllByText('Incendra').length).toBeGreaterThan(0)
    expect(screen.getByText('Home content')).toBeInTheDocument()
    expect(screen.getByText(/All systems monitored/)).toBeInTheDocument()
  })
})
