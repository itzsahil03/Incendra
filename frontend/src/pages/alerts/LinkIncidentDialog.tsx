import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLinkAlertMutation } from '@/queries/useAlerts'
import { useIncidentsQuery } from '@/queries/useIncidents'
import { getErrorMessage } from '@/lib/errors'
import type { AlertResponse } from '@/api/alerts'

export function LinkIncidentDialog({
  alert,
  open,
  onClose,
}: {
  alert: AlertResponse | null
  open: boolean
  onClose: () => void
}) {
  const { data: incidents } = useIncidentsQuery(0, 100)
  const link = useLinkAlertMutation()
  const [incidentId, setIncidentId] = useState('')

  async function handleLink() {
    if (!alert || !incidentId) return
    try {
      await link.mutateAsync({ id: alert.id, incidentId })
      toast.success('Linked to incident')
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link {alert?.displayId} to an existing incident</DialogTitle>
        </DialogHeader>
        <Select value={incidentId} onValueChange={setIncidentId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an incident" />
          </SelectTrigger>
          <SelectContent>
            {incidents?.content.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.displayId} — {i.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!incidentId || link.isPending} onClick={handleLink}>
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
