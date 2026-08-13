import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateOrgMembershipMutation } from '@/queries/useMyOrgs'
import { getErrorMessage } from '@/lib/errors'

/** For an *existing* account creating an additional org — opened from the topbar
 *  switcher (a multi-org user adding another one) or from the zero-org empty state (an
 *  account that left its last org). Distinct from WelcomePage, which is a brand-new,
 *  not-yet-created account's *first* org — register() creates the account and its org
 *  together in one atomic call. Asks for the org's name up front, then provisions and
 *  names it in one atomic backend call (POST /api/auth/orgs) — always redirects to the
 *  dashboard on success. An earlier version created an unnamed org first and asked for a
 *  name afterward; abandoning or retrying that second step left orphaned, permanently-
 *  unnamed orgs behind (a fresh one on every "Continue" click). */
export function CreateOrganizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createOrg = useCreateOrgMembershipMutation()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setError(null)
  }

  async function handleCreate() {
    if (!name.trim()) return
    setError(null)
    try {
      await createOrg.mutateAsync(name.trim())
      toast.success('Organization created')
      onOpenChange(false)
      reset()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            You'll be its administrator, with a separate space to ingest alerts and coordinate incidents.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-org-name" className="sr-only">
            Organization name
          </Label>
          <Input
            id="new-org-name"
            autoFocus
            placeholder="Organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={!name.trim() || createOrg.isPending}>
            {createOrg.isPending ? 'Creating…' : 'Create organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
