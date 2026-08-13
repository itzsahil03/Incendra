import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { DataPagination } from '@/components/common/DataPagination'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuditEntityTypesQuery, useAuditQuery } from '@/queries/useAudit'
import type { AuditRecordResponse } from '@/api/audit'
import dayjs from '@/lib/dayjs'

export function AuditLogSettingsPage() {
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(25)
  const [entityId, setEntityId] = useState('')
  const [service, setService] = useState('')
  const [entityType, setEntityType] = useState('')
  const [selected, setSelected] = useState<AuditRecordResponse | null>(null)

  const { data: entityTypes } = useAuditEntityTypesQuery()
  const { data, isLoading, error } = useAuditQuery({
    page,
    size,
    entityId: entityId.trim() || undefined,
    service: service.trim() || undefined,
    entityType: entityType || undefined,
  })

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Every recorded action across services (90-day retention)." />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-entity-id">Filter by entity ID</Label>
          <Input
            id="filter-entity-id"
            value={entityId}
            onChange={(e) => {
              setEntityId(e.target.value)
              setPage(0)
            }}
            className="w-[220px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-service">Filter by service</Label>
          <Input
            id="filter-service"
            value={service}
            onChange={(e) => {
              setService(e.target.value)
              setPage(0)
            }}
            className="w-[220px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-entity-type">Filter by entity type</Label>
          <Select
            value={entityType || 'ALL'}
            onValueChange={(v) => {
              setEntityType(v === 'ALL' ? '' : v)
              setPage(0)
            }}
          >
            <SelectTrigger id="filter-entity-type" className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All entity types</SelectItem>
              {(entityTypes ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : data.content.length === 0 ? (
        <EmptyState title="No matching audit records" />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.content.map((record) => (
                <TableRow key={record.auditId} className="cursor-pointer" onClick={() => setSelected(record)}>
                  <TableCell>
                    <Badge variant="outline">{record.action}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {record.entityType} · {record.entityId}
                  </TableCell>
                  <TableCell>{record.service}</TableCell>
                  <TableCell className="font-mono text-xs">{record.actorId ?? '—'}</TableCell>
                  <TableCell>{dayjs(record.occurredAt).fromNow()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataPagination
            page={page}
            size={size}
            total={data.totalElements}
            onPageChange={setPage}
            onSizeChange={(s) => {
              setSize(s)
              setPage(0)
            }}
          />
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(next) => !next && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected?.action} · {selected?.entityType}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Details</p>
          <pre className="mt-0.5 max-h-[320px] overflow-auto rounded-md bg-accent p-3 font-mono text-xs">
            {selected && JSON.stringify(selected.details, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
