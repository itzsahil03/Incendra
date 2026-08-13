import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RoleGate } from '@/components/common/RoleGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getErrorMessage } from '@/lib/errors'
import { useCreateInvitationMutation, useInvitationsQuery, useRevokeInvitationMutation } from '@/queries/useInvitations'
import type { Role } from '@/features/session/sessionSlice'
import dayjs from '@/lib/dayjs'

const ROLES: Role[] = ['ADMIN', 'RESPONDER', 'VIEWER']

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['ADMIN', 'RESPONDER', 'VIEWER']),
})
type FormValues = z.infer<typeof schema>

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createInvitation = useCreateInvitationMutation()
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'VIEWER' } })

  async function onSubmit(values: FormValues) {
    try {
      await createInvitation.mutateAsync(values)
      toast.success(`Invite sent to ${values.email}`)
      reset()
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" autoFocus {...register('email')} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createInvitation.isPending}>
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function InvitationsPage() {
  const { data, isLoading, error } = useInvitationsQuery()
  const revokeInvitation = useRevokeInvitationMutation()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  async function handleRevoke() {
    if (!revoking) return
    try {
      await revokeInvitation.mutateAsync(revoking)
      toast.success('Invitation revoked')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Invitations"
        subtitle="Invite new members by email — they'll join with the role you choose here."
        actions={
          <RoleGate allow={['ADMIN']}>
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="size-4" />
              Invite member
            </Button>
          </RoleGate>
        }
      />

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState title="No pending invitations" description="Invite someone to join this org." />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{invite.role}</Badge>
                  </TableCell>
                  <TableCell>{dayjs(invite.createdAt).fromNow()}</TableCell>
                  <TableCell>{dayjs(invite.expiresAt).format('MMM D, YYYY')}</TableCell>
                  <TableCell className="text-right">
                    <RoleGate allow={['ADMIN']}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Revoke"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRevoking(invite.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Revoke</TooltipContent>
                      </Tooltip>
                    </RoleGate>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ConfirmDialog
        open={!!revoking}
        title="Revoke this invitation?"
        description="The invite link will stop working immediately."
        confirmLabel="Revoke"
        destructive
        loading={revokeInvitation.isPending}
        onConfirm={handleRevoke}
        onClose={() => setRevoking(null)}
      />
    </div>
  )
}
