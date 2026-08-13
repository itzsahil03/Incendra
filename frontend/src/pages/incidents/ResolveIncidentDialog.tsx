import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTransitionMutation } from '@/queries/useWorkflow'
import { getErrorMessage } from '@/lib/errors'

export function ResolveIncidentDialog({
  incidentId,
  displayId,
  title,
  open,
  onClose,
}: {
  incidentId: string
  displayId: string
  title: string
  open: boolean
  onClose: () => void
}) {
  const transition = useTransitionMutation(incidentId)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const trimmed = note.trim()
  const noteMissing = touched && !trimmed

  async function handleResolve() {
    setTouched(true)
    if (!trimmed) return
    try {
      await transition.mutateAsync({ toState: 'Resolved', note: trimmed })
      toast.success('Incident resolved')
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve incident</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {displayId} — {title}
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resolution-notes">Resolution notes *</Label>
          <Textarea
            id="resolution-notes"
            placeholder="What was done, and why is this resolved?"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
            aria-invalid={noteMissing}
          />
          {noteMissing && <p className="text-xs text-destructive">Required</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleResolve} disabled={transition.isPending || (touched && !trimmed)}>
            Resolve incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
