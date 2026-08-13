import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Combobox } from '@/components/common/Combobox'
import { UserAvatar } from '@/components/common/UserAvatar'
import { useAddParticipantMutation, useRemoveParticipantMutation } from '@/queries/useIncidents'
import { useUsersQuery } from '@/queries/useUsers'
import { getErrorMessage } from '@/lib/errors'
import type { IncidentResponse } from '@/api/incidents'

export function ManageParticipantsDialog({ incident, open, onClose }: { incident: IncidentResponse; open: boolean; onClose: () => void }) {
  const { data: accounts } = useUsersQuery()
  const addParticipant = useAddParticipantMutation(incident.id)
  const removeParticipant = useRemoveParticipantMutation(incident.id)
  const [selected, setSelected] = useState<string | null>(null)

  const options = useMemo(
    () => (accounts ?? []).filter((a) => !incident.participants.some((p) => p.userId === a.id)).map((a) => ({ id: a.id, label: a.name })),
    [accounts, incident.participants],
  )

  async function handleAdd() {
    const account = accounts?.find((a) => a.id === selected)
    if (!account) return
    try {
      await addParticipant.mutateAsync({ userId: account.id, userName: account.name })
      setSelected(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleRemove(userId: string) {
    try {
      await removeParticipant.mutateAsync(userId)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage participants</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Combobox
              className="min-w-[240px]"
              options={options}
              value={selected}
              onChange={setSelected}
              placeholder="Add a participant…"
              renderOption={(o) => (
                <span className="flex items-center gap-2">
                  <UserAvatar name={o.label} size={20} />
                  {o.label}
                </span>
              )}
            />
            <Button variant="outline" onClick={handleAdd} disabled={!selected || addParticipant.isPending}>
              Add
            </Button>
          </div>

          {incident.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No participants yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {incident.participants.map((p) => (
                <div key={p.userId} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={p.userName} size={28} />
                    <span className="text-sm">{p.userName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${p.userName}`}
                    onClick={() => handleRemove(p.userId)}
                    disabled={removeParticipant.isPending}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
