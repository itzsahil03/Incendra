import { Bookmark, Copy, ExternalLink, MoreVertical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { UserAvatar } from '@/components/common/UserAvatar'
import { activityDetail, activityStateValue, activityType, CATEGORY_BADGE_COLOR, type ActivityLookups } from '@/lib/activity'
import type { AuditRecordResponse } from '@/api/audit'
import { cn } from '@/lib/utils'
import dayjs from '@/lib/dayjs'

/** Shared between the Dashboard's compact "Recent activity" panel (`compact`, a narrow
 *  sidebar column — icon + connecting line, actor/time below the title) and the full
 *  /app/activity page (a wider row: time column, actor on the right, bookmark + row
 *  menu). Same underlying data and lookups either way. */
export function ActivityTimeline({
  records,
  lookups,
  showDate = false,
  compact = false,
  bookmarkedIds,
  onToggleBookmark,
}: {
  records: AuditRecordResponse[]
  lookups: ActivityLookups
  showDate?: boolean
  compact?: boolean
  bookmarkedIds?: Set<string>
  onToggleBookmark?: (auditId: string) => void
}) {
  const navigate = useNavigate()

  function entityRoute(a: AuditRecordResponse): string | null {
    if (a.entityType === 'Incident' && lookups.incidentById.has(a.entityId)) return `/app/incidents/${a.entityId}`
    if (a.entityType === 'Alert' && lookups.alertById.has(a.entityId)) return `/app/alerts/${a.entityId}`
    return null
  }

  if (compact) {
    return (
      <div className="flex flex-col">
        {records.map((a, idx) => {
          const { icon: Icon, bg, fg, label } = activityType(a.action)
          const who = a.actorId ? (lookups.nameById.get(a.actorId) ?? 'Unknown user') : 'System'
          const detail = activityDetail(a, lookups)
          const isLast = idx === records.length - 1
          const time = showDate ? dayjs(a.occurredAt).format('MMM D, HH:mm') : dayjs(a.occurredAt).format('HH:mm')

          return (
            <div key={a.auditId} className={cn('flex gap-3', !isLast && 'pb-5')}>
              <div className="flex shrink-0 flex-col items-center">
                <span
                  className="flex size-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: bg, color: fg }}
                >
                  <Icon className="size-4" />
                </span>
                {!isLast && <span className="mt-1 min-h-5 w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-bold text-foreground">{label}</p>
                {detail && <div className="mt-0.5 text-sm text-muted-foreground">{detail}</div>}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <UserAvatar name={who} size={20} />
                  <span className="text-xs text-muted-foreground">
                    {who} • {time}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {records.map((a, idx) => {
        const { icon: Icon, bg, fg, label, category } = activityType(a.action)
        const who = a.actorId ? (lookups.nameById.get(a.actorId) ?? 'Unknown user') : 'System'
        const detail = activityDetail(a, lookups)
        const stateValue = activityStateValue(a)
        const isLast = idx === records.length - 1
        const time = showDate ? dayjs(a.occurredAt).format('MMM D, h:mm A') : dayjs(a.occurredAt).format('h:mm A')
        const bookmarked = bookmarkedIds?.has(a.auditId) ?? false
        const route = entityRoute(a)

        return (
          <div key={a.auditId} className={cn('flex items-start gap-3 py-2.5', !isLast && 'border-b border-border')}>
            <div className="w-[76px] shrink-0 pt-0.5">
              <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">{time}</span>
            </div>

            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: bg, color: fg }}
            >
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-bold text-foreground">{label}</p>
                {stateValue && <Badge>{stateValue}</Badge>}
                <Badge
                  variant="outline"
                  className="border-transparent"
                  style={{ backgroundColor: `${CATEGORY_BADGE_COLOR[category]}1f`, color: CATEGORY_BADGE_COLOR[category] }}
                >
                  {category}
                </Badge>
              </div>
              {detail && <div className="mt-0.5 text-sm text-muted-foreground">{detail}</div>}
            </div>

            <div className="hidden shrink-0 items-center gap-1.5 pt-0.5 sm:flex">
              <UserAvatar name={who} size={22} />
              <span className="max-w-[140px] truncate text-sm text-foreground">{who}</span>
            </div>

            <div className="flex shrink-0 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
                    onClick={() => onToggleBookmark?.(a.auditId)}
                    disabled={!onToggleBookmark}
                  >
                    <Bookmark className={cn('size-4', bookmarked && 'fill-primary text-primary')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{bookmarked ? 'Remove bookmark' : 'Bookmark'}</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More options">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(a.auditId)}>
                    <Copy className="size-4" /> Copy Activity ID
                  </DropdownMenuItem>
                  {route && (
                    <DropdownMenuItem onClick={() => navigate(route)}>
                      <ExternalLink className="size-4" /> View {a.entityType}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )
      })}
    </div>
  )
}
