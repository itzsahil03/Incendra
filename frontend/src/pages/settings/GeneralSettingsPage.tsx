import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Copy, LogOut, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { RoleGate } from '@/components/common/RoleGate'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { useAppSelector } from '@/app/hooks'
import { useCreateOrgMutation, useOrgSummaryQuery, useOwnOrgQuery, useRotateWebhookSecretMutation, useUpdateOrgNameMutation } from '@/queries/useOrg'
import { useDeleteOrganizationMutation, useLeaveOrganizationMutation } from '@/queries/useMyOrgs'
import { getErrorMessage } from '@/lib/errors'
import dayjs from '@/lib/dayjs'

/** A brand-new org bootstrapped by registering (or via the switcher's "+ Create
 *  organization") only creates the Membership — org-service (name, webhook secret) has
 *  no matching row until someone explicitly creates one here, so GET /api/org 404s
 *  until then. Doubles as the "pending provisioning" recovery path (Backend item 5). */
function CreateOrgCard() {
  const createOrg = useCreateOrgMutation()
  const [name, setName] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    try {
      await createOrg.mutateAsync({ name: name.trim() })
      toast.success('Organization created')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <EmptyState
      title="This organization hasn't been set up yet"
      description="Your account exists, but there's no organization profile (name, webhook secret) for it yet. Create one to continue."
      action={
        <RoleGate
          allow={['ADMIN']}
          fallback={<p className="mt-2 text-sm text-muted-foreground">Ask an admin in your org to finish setting this up.</p>}
        >
          <div className="mt-2 flex w-full max-w-[360px] flex-col gap-2">
            <Input placeholder="Organization name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={handleCreate} disabled={!name.trim() || createOrg.isPending}>
              Create organization
            </Button>
          </div>
        </RoleGate>
      }
    />
  )
}

/** Only reachable for the org's sole ACTIVE admin (see GeneralSettingsPage's own gating) —
 *  requires the current password as a re-auth step, same convention as
 *  DeleteAccountDialog. Unlike leaving, this destroys the organization itself: every
 *  member's membership, and org-scoped data across every service. */
function DeleteOrganizationDialog({
  open,
  onOpenChange,
  orgName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgName: string
}) {
  const deleteOrg = useDeleteOrganizationMutation()
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
      await deleteOrg.mutateAsync(password)
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
          <DialogTitle>Delete {orgName}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the organization — every member's access, all incidents, alerts, webhooks, and
            other data. Members with no other organization will have their accounts deleted too. This can&apos;t be
            undone.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-org-password" className="sr-only">
            Current password
          </Label>
          <PasswordInput
            id="delete-org-password"
            autoFocus
            placeholder="Enter your password to confirm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete} disabled={!password || deleteOrg.isPending}>
            {deleteOrg.isPending ? 'Deleting…' : 'Delete organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GeneralSettingsPage() {
  const { data: org, isLoading, error } = useOwnOrgQuery()
  const { data: summary } = useOrgSummaryQuery()
  const rotateSecret = useRotateWebhookSecretMutation()
  const updateName = useUpdateOrgNameMutation()
  const leaveOrg = useLeaveOrganizationMutation()
  const role = useAppSelector((s) => s.session.user?.role)
  const [name, setName] = useState('')
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (org) setName(org.name)
  }, [org])

  async function handleSaveName() {
    if (!org || name.trim() === org.name) return
    try {
      await updateName.mutateAsync(name.trim())
      toast.success('Organization name updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleLeave() {
    try {
      await leaveOrg.mutateAsync()
      toast.success('Left the organization')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setConfirmingLeave(false)
    }
  }

  if (error) {
    if (isAxiosError(error) && error.response?.status === 404) return <CreateOrgCard />
    return <ErrorState error={error} />
  }
  if (isLoading || !org) return <LoadingState minHeight={160} />

  const isAdmin = role === 'ADMIN'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="General" subtitle="Your organization's identity, membership, and inbound webhook secret." />

      <Card>
        <CardContent>
          <p className="mb-3 text-sm font-bold">Organization Profile</p>
          <div className="flex max-w-[480px] items-start gap-2">
            <div className="flex-1">
              <Label htmlFor="org-name" className="mb-1.5">
                Organization name
              </Label>
              <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
            </div>
            <RoleGate allow={['ADMIN']}>
              <Button
                className="mt-6.5"
                disabled={!name.trim() || name.trim() === org.name || updateName.isPending}
                onClick={handleSaveName}
              >
                Save
              </Button>
            </RoleGate>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="mb-3 text-sm font-bold">Organization Information</p>
          <dl className="grid max-w-[480px] grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Created</dt>
              <dd className="mt-0.5 font-medium">{dayjs(org.createdAt).format('MMM D, YYYY')}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Members</dt>
              <dd className="mt-0.5 font-medium">{summary?.memberCount ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Administrators</dt>
              <dd className="mt-0.5 font-medium">{summary?.adminCount ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="mb-3 text-sm font-bold">Security &amp; Integrations</p>
          <div className="flex max-w-[520px] flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input value={org.webhookSecret} readOnly className="font-mono" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(org.webhookSecret)
                  toast.success('Copied')
                }}
              >
                <Copy className="size-4" />
                Copy
              </Button>
              <RoleGate allow={['ADMIN']}>
                <Button variant="outline" onClick={() => rotateSecret.mutate()} disabled={rotateSecret.isPending}>
                  <RefreshCw className="size-4" />
                  Rotate
                </Button>
              </RoleGate>
            </div>
            <p className="text-xs text-muted-foreground">
              Used to verify HMAC signatures on inbound alert webhooks — rotating it invalidates any monitoring
              integration's existing signature until it's updated with the new value.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="mb-1 text-sm font-bold">Leave Organization</p>
          <p className="mb-3 max-w-[520px] text-xs text-muted-foreground">
            Removes your own membership in {org.name}. If you're this organization's only administrator, you'll need
            to promote someone else first.
          </p>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmingLeave(true)}>
            <LogOut className="size-4" />
            Leave organization
          </Button>
        </CardContent>
      </Card>

      {isAdmin && summary?.adminCount === 1 && (
        <Card className="border-destructive/30">
          <CardContent>
            <p className="mb-1 text-sm font-bold">Delete Organization</p>
            <p className="mb-3 max-w-[520px] text-xs text-muted-foreground">
              Permanently deletes {org.name} — every member's access, all incidents, alerts, webhooks, and other
              data. Members with no other organization will have their accounts deleted too. This can't be undone.
              Only available to the organization's sole administrator.
            </p>
            <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="size-4" />
              Delete organization
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmingLeave}
        title={`Leave ${org.name}?`}
        description="You'll lose access to this organization's incidents, alerts, and settings immediately."
        confirmLabel="Leave"
        destructive
        loading={leaveOrg.isPending}
        onConfirm={handleLeave}
        onClose={() => setConfirmingLeave(false)}
      />

      <DeleteOrganizationDialog open={confirmingDelete} onOpenChange={setConfirmingDelete} orgName={org.name} />
    </div>
  )
}
