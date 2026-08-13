import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/integrations/StatusBadge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import dayjs from '@/lib/dayjs'
import { DELIVERY_OUTCOME_COLOR, DELIVERY_OUTCOME_LABEL } from '@/lib/webhookDeliveryStatus'
import { useDeliveryPayloadQuery } from '@/queries/useWebhookDeliveries'
import type { Page } from '@/api/types'
import type { WebhookDeliveryResponse } from '@/api/webhookDeliveries'

function DeliveryRow({ delivery, webhookLabel }: { delivery: WebhookDeliveryResponse; webhookLabel?: string }) {
  const [expanded, setExpanded] = useState(false)
  const { data: payload, isLoading } = useDeliveryPayloadQuery(expanded ? delivery.id : undefined)
  const columnCount = webhookLabel !== undefined ? 7 : 6

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <TableCell className="w-8">
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
          {dayjs(delivery.attemptedAt).format('MMM D, h:mm:ss A')}
        </TableCell>
        {webhookLabel !== undefined && <TableCell className="max-w-[200px] truncate font-mono text-xs">{webhookLabel}</TableCell>}
        <TableCell className="text-sm">{delivery.topic}</TableCell>
        <TableCell>
          <StatusBadge
            label={delivery.outcome === 'RETRYING' ? `Retrying (attempt ${delivery.attemptNumber})` : DELIVERY_OUTCOME_LABEL[delivery.outcome]}
            color={DELIVERY_OUTCOME_COLOR[delivery.outcome]}
          />
        </TableCell>
        <TableCell className="text-sm tabular-nums">{delivery.statusCode ?? '—'}</TableCell>
        <TableCell className="text-sm tabular-nums">{delivery.latencyMs}ms</TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={columnCount} className="bg-muted/30">
            {isLoading || !payload ? (
              <LoadingState minHeight={60} />
            ) : (
              <div className="grid grid-cols-1 gap-3 p-2 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Request Body</p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-background p-2 font-mono text-[11px]">{payload.requestBody ?? '—'}</pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Response</p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-background p-2 font-mono text-[11px]">{payload.responseBody ?? '—'}</pre>
                  {Object.keys(payload.responseHeaders).length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {Object.entries(payload.responseHeaders).map(([k, v]) => (
                        <p key={k} className="font-mono text-[10px] text-muted-foreground">
                          {k}: {v}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

/** Shared table used by both the per-webhook delivery log (WebhookDetailPage) and the
 *  org-wide Delivery Logs page — pass `webhookLabels` to show a Webhook column (org-wide
 *  view only). Row expand lazily fetches the request/response payload for that one
 *  delivery, never joined into the list query itself. */
export function DeliveryTable({
  deliveries,
  loading,
  page,
  onPageChange,
  webhookLabels,
}: {
  deliveries: Page<WebhookDeliveryResponse> | undefined
  loading: boolean
  page: number
  onPageChange: (page: number) => void
  webhookLabels?: Record<string, string>
}) {
  if (loading || !deliveries) return <LoadingState minHeight={160} />
  if (deliveries.content.length === 0) {
    return <EmptyState title="No deliveries yet" description="Deliveries will appear here once a matching event fires, or after you send a test." />
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>Time</TableHead>
            {webhookLabels && <TableHead>Webhook</TableHead>}
            <TableHead>Topic</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Latency</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.content.map((d) => (
            <DeliveryRow key={d.id} delivery={d} webhookLabel={webhookLabels?.[d.webhookId] ?? (webhookLabels ? d.webhookId : undefined)} />
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border p-3">
        <p className="text-xs text-muted-foreground">
          Page {deliveries.number + 1} of {Math.max(deliveries.totalPages, 1)} &middot; {deliveries.totalElements} total
        </p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" disabled={deliveries.first} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={deliveries.last} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
