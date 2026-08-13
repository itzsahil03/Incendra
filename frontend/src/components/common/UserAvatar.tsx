import { Settings } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const PALETTE = [
  { bg: 'rgba(109,104,196,0.35)', fg: '#e8e6fb' },
  { bg: 'rgba(109,149,224,0.3)', fg: '#cddcf7' },
  { bg: 'rgba(79,191,143,0.28)', fg: '#c3f0dd' },
  { bg: 'rgba(221,154,76,0.3)', fg: '#f5dcb0' },
  { bg: 'rgba(229,118,108,0.28)', fg: '#f7cfca' },
  { bg: 'rgba(147,142,222,0.32)', fg: '#e3e1fb' },
  { bg: 'rgba(203,179,90,0.28)', fg: '#f0e6bd' },
]

function colorFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/** Stand-in "profile picture" — there are no uploaded avatar images anywhere in this
 *  app, so a colored initial (consistent per name, via a simple hash) is the honest
 *  substitute, same idea as the Topbar's own account-menu avatar. "System" (activity
 *  with no human actor — a webhook-ingested alert, an unlink with no real actor
 *  captured) gets a gear icon instead of a fabricated initial. */
export function UserAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const style = { width: size, height: size }

  if (name === 'System') {
    return (
      <Avatar style={style} className="bg-muted">
        <AvatarFallback className="bg-transparent text-muted-foreground">
          <Settings style={{ width: size * 0.55, height: size * 0.55 }} />
        </AvatarFallback>
      </Avatar>
    )
  }

  const { bg, fg } = colorFor(name)
  return (
    <Avatar style={style}>
      <AvatarFallback
        style={{ backgroundColor: bg, color: fg, fontSize: size * 0.42 }}
        className="bg-transparent font-bold"
      >
        {name.trim()[0]?.toUpperCase() ?? '?'}
      </AvatarFallback>
    </Avatar>
  )
}
