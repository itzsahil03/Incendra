import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TagInput } from '@/components/common/TagInput'
import { useUpdateContextMutation } from '@/queries/useIncidents'
import { getErrorMessage } from '@/lib/errors'
import type { IncidentResponse } from '@/api/incidents'

export function ImpactContextDialog({ incident, open, onClose }: { incident: IncidentResponse; open: boolean; onClose: () => void }) {
  const updateContext = useUpdateContextMutation(incident.id)
  const [environment, setEnvironment] = useState(incident.environment ?? '')
  const [region, setRegion] = useState(incident.region ?? '')
  const [businessImpact, setBusinessImpact] = useState(incident.businessImpact ?? '')
  const [affectedComponents, setAffectedComponents] = useState<string[]>(incident.affectedComponents)
  const [contextNotes, setContextNotes] = useState(incident.contextNotes ?? '')

  async function handleSave() {
    try {
      await updateContext.mutateAsync({
        environment: environment.trim() || null,
        region: region.trim() || null,
        businessImpact: businessImpact.trim() || null,
        affectedComponents,
        contextNotes: contextNotes.trim() || null,
      })
      toast.success('Impact & context updated')
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit impact & context</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="environment">Environment</Label>
            <Input id="environment" value={environment} onChange={(e) => setEnvironment(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="region">Region</Label>
            <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="business-impact">Business impact</Label>
            <Input
              id="business-impact"
              placeholder="e.g. Degraded performance, Full outage"
              value={businessImpact}
              onChange={(e) => setBusinessImpact(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Affected components</Label>
            <TagInput value={affectedComponents} onChange={setAffectedComponents} placeholder="Type a component, press Enter" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="context-notes">Notes</Label>
            <Textarea id="context-notes" rows={2} value={contextNotes} onChange={(e) => setContextNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateContext.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
