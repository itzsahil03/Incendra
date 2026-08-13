import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IntegrationsShell } from './IntegrationsShell'

function renderShell(path = '/app/integrations/overview') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/integrations" element={<IntegrationsShell />}>
          <Route path="overview" element={<div>Overview content</div>} />
          <Route path="keys" element={<div>Keys content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('IntegrationsShell', () => {
  it('renders the nav groups and the routed outlet content', () => {
    renderShell()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('Incoming')).toBeInTheDocument()
    expect(screen.getByText('Outgoing')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Overview/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /API Keys/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Webhooks/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Delivery Logs/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Connected Apps/ })).toBeInTheDocument()
    expect(screen.getByText('Overview content')).toBeInTheDocument()
  })

  it('marks the active nav link', () => {
    renderShell('/app/integrations/keys')
    expect(screen.getByRole('link', { name: /API Keys/ })).toHaveClass('bg-accent')
    expect(screen.getByText('Keys content')).toBeInTheDocument()
  })
})
