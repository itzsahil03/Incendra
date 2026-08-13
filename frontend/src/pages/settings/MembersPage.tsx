import { useMemo, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { RoleGate } from '@/components/common/RoleGate'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAppSelector } from '@/app/hooks'
import { getErrorMessage } from '@/lib/errors'
import { useAccountsQuery, useRemoveMemberMutation, useUpdateAccountRoleMutation } from '@/queries/useAccounts'
import type { Role } from '@/features/session/sessionSlice'
import dayjs from '@/lib/dayjs'

const ROLES: Role[] = ['ADMIN', 'RESPONDER', 'VIEWER']
const ROLE_FILTERS = ['ALL', ...ROLES] as const

/** Threshold below which the search/filter bar hides itself — a handful of members are
 *  easier to just scan than to filter. */
const SEARCH_THRESHOLD = 5

export function MembersPage() {
  const { data: accounts, isLoading, error } = useAccountsQuery()
  const removeMember = useRemoveMemberMutation()
  const updateRole = useUpdateAccountRoleMutation()
  const currentUserId = useAppSelector((s) => s.session.user?.id)
  const isAdmin = useAppSelector((s) => s.session.user?.role === 'ADMIN')
  const [deleting, setDeleting] = useState<{ id: string; name: string } | undefined>()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>('ALL')
  const [joinedFrom, setJoinedFrom] = useState('')
  const [joinedTo, setJoinedTo] = useState('')

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (accounts ?? []).filter((account) => {
      if (q && !account.name.toLowerCase().includes(q) && !account.email.toLowerCase().includes(q)) return false
      if (roleFilter !== 'ALL' && account.role !== roleFilter) return false
      const joinedDay = dayjs(account.createdAt).format('YYYY-MM-DD')
      if (joinedFrom && joinedDay < joinedFrom) return false
      if (joinedTo && joinedDay > joinedTo) return false
      return true
    })
  }, [accounts, search, roleFilter, joinedFrom, joinedTo])

  const showFilterBar = (accounts?.length ?? 0) > SEARCH_THRESHOLD

  async function handleDelete() {
    if (!deleting) return
    try {
      await removeMember.mutateAsync(deleting.id)
      toast.success('Removed from the org')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeleting(undefined)
    }
  }

  async function handleRoleChange(id: string, role: Role) {
    try {
      await updateRole.mutateAsync({ id, role })
      toast.success('Role updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Everyone with access to this org. To add someone new, send them an invite from the Invitations tab."
      />

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !accounts ? (
        <LoadingState />
      ) : (
        <>
          {showFilterBar && (
            <div className="mb-4 flex flex-wrap items-end gap-2.5">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search members…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-full pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as (typeof ROLE_FILTERS)[number])}>
                <SelectTrigger size="sm" className="w-[140px] rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-end gap-1.5">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="joined-from" className="text-xs text-muted-foreground">
                    Joined from
                  </Label>
                  <Input
                    id="joined-from"
                    type="date"
                    value={joinedFrom}
                    max={joinedTo || undefined}
                    onChange={(e) => setJoinedFrom(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="joined-to" className="text-xs text-muted-foreground">
                    Joined to
                  </Label>
                  <Input
                    id="joined-to"
                    type="date"
                    value={joinedTo}
                    min={joinedFrom || undefined}
                    onChange={(e) => setJoinedTo(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
                {(joinedFrom || joinedTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setJoinedFrom('')
                      setJoinedTo('')
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}

          {filteredAccounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members match your search or filters.</p>
          ) : (
            <Card className="gap-0 overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar name={account.name} size={26} />
                          <span className="text-sm">
                            {account.name}{' '}
                            {account.id === currentUserId && <span className="text-xs text-muted-foreground">(you)</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{account.email}</TableCell>
                      <TableCell>
                        {isAdmin && account.id !== currentUserId ? (
                          <Select value={account.role} onValueChange={(v) => handleRoleChange(account.id, v as Role)}>
                            <SelectTrigger size="sm" className="w-[140px] rounded-full">
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
                        ) : (
                          <Badge variant="outline">{account.role}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{dayjs(account.createdAt).format('MMM D, YYYY')}</TableCell>
                      <TableCell className="text-right">
                        <RoleGate allow={['ADMIN']}>
                          {account.id !== currentUserId && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${account.name}`}
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleting({ id: account.id, name: account.name })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </RoleGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Remove ${deleting?.name} from this organization?`}
        description="This only removes their access to this organization — their account and any other organizations they belong to are unaffected."
        confirmLabel="Remove"
        destructive
        loading={removeMember.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleting(undefined)}
      />
    </div>
  )
}
