import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAccountsQuery } from '@/queries/useAccounts'
import { ROLE_DEFINITIONS, type RoleDefinition } from '@/lib/rolePermissions'

function RoleCard({ definition, memberCount, onViewPermissions }: { definition: RoleDefinition; memberCount: number; onViewPermissions: () => void }) {
  return (
    <Card className="gap-3 p-5">
      <div>
        <p className="text-base font-semibold">{definition.label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{definition.description}</p>
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
        <Button variant="outline" size="sm" onClick={onViewPermissions}>
          View Permissions
        </Button>
      </div>
    </Card>
  )
}

function RolePermissionsSheet({ definition, onClose }: { definition: RoleDefinition | null; onClose: () => void }) {
  if (!definition) return null

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{definition.label} permissions</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-5 overflow-y-auto p-4">
          <p className="text-sm text-muted-foreground">{definition.description}</p>
          {definition.groups.map((group) => (
            <div key={group.resource} className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground uppercase">{group.resource}</p>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm">
                    {item.allowed ? (
                      <Check className="size-4 shrink-0 text-emerald-500" />
                    ) : (
                      <X className="size-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className={item.allowed ? '' : 'text-muted-foreground'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function RolesSettingsPage() {
  const { data, isLoading, error } = useAccountsQuery()
  const [viewing, setViewing] = useState<RoleDefinition | null>(null)

  return (
    <div>
      <PageHeader title="Roles & Permissions" subtitle="What each role is allowed to do. To change someone's role, use the Members page." />

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_DEFINITIONS.map((definition) => (
            <RoleCard
              key={definition.role}
              definition={definition}
              memberCount={data.filter((a) => a.role === definition.role).length}
              onViewPermissions={() => setViewing(definition)}
            />
          ))}
        </div>
      )}

      <RolePermissionsSheet definition={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
