import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Animated gradient-sweep text used for the emphasized line of marketing-site
 *  headlines (see `.shine-text` in index.css). */
export function ShineText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('shine-text', className)}>{children}</span>
}
