import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Row-count pagination control (page + page-size + "X–Y of Z") — the shadcn/Tailwind
 *  replacement for MUI's `TablePagination`. `page` is 0-indexed to match the existing
 *  page-state convention used across the list pages. */
export function DataPagination({
  page,
  size,
  total,
  onPageChange,
  onSizeChange,
  sizeOptions = [10, 25, 50, 100],
}: {
  page: number
  size: number
  total: number
  onPageChange: (page: number) => void
  onSizeChange: (size: number) => void
  sizeOptions?: number[]
}) {
  const pageCount = Math.max(1, Math.ceil(total / size))
  const from = total === 0 ? 0 : page * size + 1
  const to = Math.min(total, (page + 1) * size)

  return (
    <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border px-3 py-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <Select value={String(size)} onValueChange={(v) => onSizeChange(Number(v))}>
          <SelectTrigger size="sm" className="w-[72px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizeOptions.map((opt) => (
              <SelectItem key={opt} value={String(opt)}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Previous page" onClick={() => onPageChange(page - 1)} disabled={page <= 0}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount - 1}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
