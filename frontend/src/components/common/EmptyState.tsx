import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  compact,
}: {
  title: string
  description?: string
  action?: ReactNode
  /** Hugs the content instead of the full-page centered treatment — for small cards
   *  (e.g. a sidebar section with nothing in it yet) where py-12 reads as oversized. */
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col justify-center gap-1',
        compact ? 'items-start px-0 py-1 text-left' : 'items-center gap-2 px-4 py-12 text-center',
      )}
    >
      <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {description && (
        <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'max-w-[420px] text-sm')}>{description}</p>
      )}
      {action}
    </div>
  )
}
