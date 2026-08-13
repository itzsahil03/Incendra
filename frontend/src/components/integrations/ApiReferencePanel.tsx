import { Code2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

export interface ApiReferenceEndpoint {
  method: string
  path: string
  description?: string
}

/** In-app "API Reference" affordance — built from real, already-implemented endpoints
 *  and the viewer's own actual key/webhook data, rather than linking to a docs site
 *  that doesn't exist in this app. Reused by the API key detail sheet and the webhook
 *  detail page. */
export function ApiReferencePanel({
  endpoints,
  headers,
  curlExample,
}: {
  endpoints: ApiReferenceEndpoint[]
  headers: { name: string; value: string }[]
  curlExample: string
}) {
  function copy() {
    navigator.clipboard.writeText(curlExample)
    toast.success('Copied to clipboard')
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Code2 className="size-4" />
          API Reference
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px]" align="end">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {endpoints.map((e) => (
              <div key={e.method + e.path} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className="shrink-0 font-mono">
                  {e.method}
                </Badge>
                <div>
                  <p className="font-mono text-foreground">{e.path}</p>
                  {e.description && <p className="mt-0.5 text-muted-foreground">{e.description}</p>}
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Headers</p>
            {headers.map((h) => (
              <p key={h.name} className="font-mono text-xs">
                <span className="text-muted-foreground">{h.name}:</span> {h.value}
              </p>
            ))}
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Example</p>
              <Button variant="ghost" size="icon-sm" aria-label="Copy example" onClick={copy}>
                <Copy className="size-3.5" />
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {curlExample}
            </pre>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
