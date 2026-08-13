import { TriangleAlert, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface SecretRevealDialogProps {
  open: boolean
  label: string
  secret: string
  onClose: () => void
}

/** Shown exactly once, immediately after create/rotate — the backend never returns
 *  this value again (only its hash is stored), same convention for API key secrets,
 *  refresh tokens, and webhook signing secrets. */
export function SecretRevealDialog({ open, label, secret, onClose }: SecretRevealDialogProps) {
  function copy() {
    navigator.clipboard.writeText(secret)
    toast.success('Copied to clipboard')
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Alert>
            <TriangleAlert />
            <AlertDescription>Copy this now — it won&apos;t be shown again.</AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Input value={secret} readOnly className="font-mono" />
            <Button variant="outline" onClick={copy}>
              <Copy className="size-4" />
              Copy
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
