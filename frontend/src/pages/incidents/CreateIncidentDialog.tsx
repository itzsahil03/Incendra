import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateIncidentMutation } from '@/queries/useIncidents'
import { getErrorMessage } from '@/lib/errors'
import { useAppSelector } from '@/app/hooks'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function CreateIncidentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const createIncident = useCreateIncidentMutation()
  const currentUser = useAppSelector((s) => s.session.user)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { priority: 'P3' } })

  async function onSubmit(values: FormValues) {
    try {
      const incident = await createIncident.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        priority: values.priority || undefined,
        reporterId: currentUser?.id,
        reporterName: currentUser?.name,
      })
      toast.success('Incident created')
      reset()
      onClose()
      navigate(`/app/incidents/${incident.id}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New incident</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" autoFocus {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register('description')} />
          </div>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <Label>Priority</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['P1', 'P2', 'P3', 'P4'].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createIncident.isPending}>
              {createIncident.isPending ? 'Creating…' : 'Create incident'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
