import { providerInfo } from '@/lib/providers'

export function ProviderBadge({ provider, className }: { provider: string; className?: string }) {
  const info = providerInfo(provider)
  const Icon = info.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground ${className ?? ''}`}>
      <Icon className="size-3.5" style={{ color: info.color }} />
      {info.displayName}
    </span>
  )
}
