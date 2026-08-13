import { Bookmark } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { UserAvatar } from '@/components/common/UserAvatar'
import { activityDetail, activityType, CATEGORY_BADGE_COLOR, type ActivityLookups } from '@/lib/activity'
import type { AuditRecordResponse } from '@/api/audit'
import { cn } from '@/lib/utils'
import dayjs from '@/lib/dayjs'

/** The Table view mode for the Activity page — same registry/detail helpers and actor
 *  rendering as ActivityTimeline, laid out as rows instead of a connected feed. */
export function ActivityTable({
  records,
  lookups,
  bookmarkedIds,
  onToggleBookmark,
}: {
  records: AuditRecordResponse[]
  lookups: ActivityLookups
  bookmarkedIds?: Set<string>
  onToggleBookmark?: (auditId: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-9" />
          <TableHead>Time</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>Actor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((a) => {
          const bookmarked = bookmarkedIds?.has(a.auditId) ?? false
          const { icon: Icon, bg, fg, label, category } = activityType(a.action)
          const who = a.actorId ? (lookups.nameById.get(a.actorId) ?? 'Unknown user') : 'System'
          const detail = activityDetail(a, lookups)
          return (
            <TableRow key={a.auditId}>
              <TableCell>
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
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <p className="text-sm">{dayjs(a.occurredAt).format('MMM D, HH:mm')}</p>
                <p className="text-xs text-muted-foreground">{dayjs(a.occurredAt).fromNow()}</p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-6.5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{label}</p>
                    <Badge
                      variant="outline"
                      className="border-transparent px-1.5 py-0 text-[10px]"
                      style={{ backgroundColor: `${CATEGORY_BADGE_COLOR[category]}1f`, color: CATEGORY_BADGE_COLOR[category] }}
                    >
                      {category}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-[360px]">
                {detail ? (
                  <div className="text-sm break-words text-muted-foreground">{detail}</div>
                ) : (
                  <p className="text-sm text-muted-foreground/50">—</p>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <UserAvatar name={who} size={22} />
                  <span className="text-sm">{who}</span>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
