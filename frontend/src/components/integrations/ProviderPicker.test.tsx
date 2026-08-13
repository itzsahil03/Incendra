import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProviderPicker } from './ProviderPicker'

describe('ProviderPicker', () => {
  it('only shows providers that support the given filter (supportsApiKey)', () => {
    render(<ProviderPicker value="GENERIC" onChange={vi.fn()} filter="supportsApiKey" />)
    // Datadog and Prometheus support API keys; Slack/Teams/Jira/PagerDuty do not.
    expect(screen.getByRole('radio', { name: /Datadog/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Prometheus/i })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Slack/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /PagerDuty/i })).not.toBeInTheDocument()
  })

  it('only shows providers that support the given filter (supportsWebhook)', () => {
    render(<ProviderPicker value="GENERIC" onChange={vi.fn()} filter="supportsWebhook" />)
    expect(screen.getByRole('radio', { name: /Slack/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /PagerDuty/i })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Datadog/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Prometheus/i })).not.toBeInTheDocument()
  })

  it('marks the currently selected provider as pressed/on', () => {
    render(<ProviderPicker value="SLACK" onChange={vi.fn()} filter="supportsWebhook" />)
    expect(screen.getByRole('radio', { name: /Slack/i })).toHaveAttribute('data-state', 'on')
    expect(screen.getByRole('radio', { name: /Teams/i })).toHaveAttribute('data-state', 'off')
  })

  it('calls onChange with the newly selected provider', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ProviderPicker value="SLACK" onChange={onChange} filter="supportsWebhook" />)
    await user.click(screen.getByRole('radio', { name: /Teams/i }))
    expect(onChange).toHaveBeenCalledWith('TEAMS')
  })
})
