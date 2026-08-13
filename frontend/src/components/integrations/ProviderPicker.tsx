import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PROVIDERS, PROVIDER_INFO, type Provider } from '@/lib/providers'

/** "Choose Provider" control used by both CreateClientDialog and CreateWebhookDialog —
 *  a single-select ToggleGroup (spaced, not the joined-segmented-control look, since
 *  the option count wraps across lines) filtered to providers that actually support
 *  the connection type being created. */
export function ProviderPicker({
  value,
  onChange,
  filter,
}: {
  value: Provider
  onChange: (p: Provider) => void
  filter: 'supportsApiKey' | 'supportsWebhook'
}) {
  const options = PROVIDERS.filter((p) => PROVIDER_INFO[p][filter])

  return (
    <ToggleGroup
      type="single"
      spacing={6}
      value={value}
      onValueChange={(v) => v && onChange(v as Provider)}
      variant="outline"
      className="flex flex-wrap gap-1.5"
    >
      {options.map((p) => {
        const info = PROVIDER_INFO[p]
        const Icon = info.icon
        return (
          <ToggleGroupItem key={p} value={p} className="gap-1.5 rounded-full border-border data-[state=on]:bg-accent">
            <Icon className="size-3.5" style={{ color: info.color }} />
            {info.displayName}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
