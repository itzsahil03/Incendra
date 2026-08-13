import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { useAppSelector } from '@/app/hooks'
import { useDeleteAccountMutation } from '@/queries/useAccounts'
import { getErrorMessage } from '@/lib/errors'

/** Requires the current password as a re-auth step, same convention as
 *  ChangePasswordPage — a destructive, irreversible action shouldn't be triggerable from
 *  just a left-open session. The backend also rejects this (409) if the caller is the
 *  sole admin of any org they belong to; that error surfaces here as-is. */
function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const deleteAccount = useDeleteAccountMutation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setPassword('')
    setError(null)
  }

  async function handleDelete() {
    if (!password) return
    setError(null)
    try {
      await deleteAccount.mutateAsync(password)
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
          <DialogTitle>Delete your account</DialogTitle>
          <DialogDescription>
            This permanently deletes your account and removes you from every organization you belong to. This can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-account-password" className="sr-only">
            Current password
          </Label>
          <PasswordInput
            id="delete-account-password"
            autoFocus
            placeholder="Enter your password to confirm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete} disabled={!password || deleteAccount.isPending}>
            {deleteAccount.isPending ? 'Deleting…' : 'Delete account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProfilePage() {
  const user = useAppSelector((s) => s.session.user)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Profile" subtitle="Your identity in this org." />

      <Card>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <span className="font-semibold">Name:</span> {user?.name}
            </p>
            <p>
              <span className="font-semibold">Email:</span> {user?.email}
            </p>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Role:</span> <Badge variant="outline">{user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="mb-1 text-sm font-bold">Delete Account</p>
          <p className="mb-3 max-w-[520px] text-xs text-muted-foreground">
            Permanently deletes your account and removes you from every organization you belong to. If you're the
            only administrator of an organization, promote someone else there first.
          </p>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" />
            Delete my account
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountDialog open={confirmOpen} onOpenChange={setConfirmOpen} />
    </div>
  )
}
