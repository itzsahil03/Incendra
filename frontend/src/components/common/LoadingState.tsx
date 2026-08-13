import { Loader2 } from 'lucide-react'

export function LoadingState({ minHeight = 240 }: { minHeight?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ minHeight }}>
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
