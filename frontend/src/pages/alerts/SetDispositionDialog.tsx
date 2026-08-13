import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Ban, Copy, FlaskConical, CircleHelp, BellOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSetAlertDispositionMutation } from '@/queries/useAlerts'
import { ALERT_DISPOSITIONS, DISPOSITION_COLORS, DISPOSITION_LABELS } from '@/lib/alertDisposition'
import { getErrorMessage } from '@/lib/errors'
import type { AlertDetailResponse, AlertDisposition } from '@/api/alerts'

const DISPOSITION_ICONS: Record<AlertDisposition, LucideIcon> = {
  ACTION_REQUIRED: TriangleAlert,
  FALSE_POSITIVE: Ban,
  DUPLICATE: Copy,
  SUPPRESSED: BellOff,
  AUTO_RECOVERED: RefreshCw,
  TEST: FlaskConical,
  UNKNOWN: CircleHelp,
}

export function SetDispositionDialog({
  alert,
  open,
  onClose,
}: {
  alert: AlertDetailResponse
  open: boolean
  onClose: () => void
}) {
  const setDisposition = useSetAlertDispositionMutation()
  const [disposition, setDispositionValue] = useState<AlertDisposition | null>(alert.disposition)
  const [reason, setReason] = useState(alert.dispositionReason ?? '')
  const [touched, setTouched] = useState(false)
  const reasonMissing = touched && !reason.trim()
  const canSave = !!disposition && !!reason.trim()

  async function handleSave() {
    setTouched(true)
    if (!disposition || !reason.trim()) return
    try {
      await setDisposition.mutateAsync({ id: alert.id, disposition, reason: reason.trim() })
      toast.success('Alert resolved')
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve alert</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {alert.displayId} — {alert.title}
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                DISPOSITION <span className="text-destructive">*</span>
              </span>
              {touched && !disposition && <span className="text-xs text-destructive">Required</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALERT_DISPOSITIONS.map((d) => {
                const Icon = DISPOSITION_ICONS[d]
                const color = DISPOSITION_COLORS[d]
                const selected = d === disposition
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDispositionValue(d)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border-[1.5px] px-2.5 py-2 text-left transition-colors',
                      selected ? '' : 'border-border hover:bg-accent',
                    )}
                    style={selected ? { borderColor: color, backgroundColor: `${color}14` } : undefined}
                  >
                    <span
                      className="flex size-[26px] shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${color}1f`, color }}
                    >
                      <Icon className="size-[15px]" />
                    </span>
                    <span
                      className={cn('truncate text-sm', selected ? 'font-bold' : 'font-medium')}
                      style={selected ? { color } : undefined}
                    >
                      {DISPOSITION_LABELS[d]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resolution-reason">Resolution notes *</Label>
            <Textarea
              id="resolution-reason"
              placeholder="What happened, and why is this resolved?"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={reasonMissing}
            />
            {reasonMissing && <p className="text-xs text-destructive">Required</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={setDisposition.isPending || (touched && !canSave)}
            style={disposition ? { backgroundColor: DISPOSITION_COLORS[disposition] } : undefined}
          >
            {disposition ? `Resolve as ${DISPOSITION_LABELS[disposition]}` : 'Resolve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
