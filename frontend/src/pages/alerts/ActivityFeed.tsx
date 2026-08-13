import { useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ClipboardList, CircleCheck, MessageCircle, Trash2, Pencil, Link2, Unlink, BellRing, UserPlus, UserX, Send, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAddAlertNoteMutation, useDeleteAlertNoteMutation, useEditAlertNoteMutation } from '@/queries/useAlerts'
import { useAppSelector } from '@/app/hooks'
import { UserAvatar } from '@/components/common/UserAvatar'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { getErrorMessage } from '@/lib/errors'
import dayjs from '@/lib/dayjs'
import type { AlertHistoryEntry, AlertHistoryType, AlertNote } from '@/api/alerts'

const HISTORY_TYPE_META: Partial<Record<AlertHistoryType, { icon: LucideIcon; color: string }>> = {
  RECEIVED: { icon: BellRing, color: '#938ede' },
  ACKNOWLEDGED: { icon: CircleCheck, color: '#6d95e0' },
  RESOLVED: { icon: CircleCheck, color: '#4fbf8f' },
  STATUS_CHANGED: { icon: ArrowRight, color: 'rgba(255,255,255,0.5)' },
  PRIORITY_CHANGED: { icon: ArrowRight, color: '#e5766c' },
  ASSIGNED: { icon: UserPlus, color: '#6d95e0' },
  UNASSIGNED: { icon: UserX, color: 'rgba(255,255,255,0.5)' },
  LINKED: { icon: Link2, color: '#938ede' },
  UNLINKED: { icon: Unlink, color: 'rgba(255,255,255,0.5)' },
}
const DEFAULT_META = { icon: ClipboardList, color: 'rgba(255,255,255,0.5)' }

/** Real filter, not decorative — each group maps to the history types it actually covers,
 *  so "All events" aside, picking a group genuinely narrows the list. */
export const HISTORY_FILTERS: { key: string; label: string; types?: AlertHistoryType[] }[] = [
  { key: 'all', label: 'All events' },
  { key: 'status', label: 'Status', types: ['ACKNOWLEDGED', 'RESOLVED', 'STATUS_CHANGED'] },
  { key: 'assignment', label: 'Assignment', types: ['ASSIGNED', 'UNASSIGNED'] },
  { key: 'incidents', label: 'Incidents', types: ['LINKED', 'UNLINKED'] },
  { key: 'priority', label: 'Priority', types: ['PRIORITY_CHANGED'] },
]

function describeHistory(entry: AlertHistoryEntry, accountLabels: Map<string, string>): { title: ReactNode; detail?: string } {
  const actor = entry.actorName ?? (entry.actorId ? accountLabels.get(entry.actorId) : undefined) ?? 'Someone'
  switch (entry.type) {
    case 'RECEIVED':
      return { title: entry.note ?? 'Alert received' }
    case 'ACKNOWLEDGED':
      return { title: `${actor} acknowledged this alert` }
    case 'RESOLVED': {
      if (entry.note?.startsWith('Resolved as ')) {
        const [dispositionLabel, reason] = entry.note.slice('Resolved as '.length).split(' — ')
        return {
          title: (
            <>
              {actor} resolved this alert as <span className="font-bold">{dispositionLabel}</span>
            </>
          ),
          detail: reason,
        }
      }
      return { title: `${actor} resolved this alert` }
    }
    case 'STATUS_CHANGED':
      return { title: `${actor} changed status to ${entry.note}` }
    case 'PRIORITY_CHANGED':
      return { title: 'Priority changed', detail: entry.note ?? undefined }
    case 'ASSIGNED':
      return { title: `Assigned to ${entry.note}` }
    case 'UNASSIGNED':
      return { title: 'Unassigned' }
    case 'LINKED':
      return { title: `Linked to Incident ${entry.note}`, detail: `by ${actor}` }
    case 'UNLINKED':
      return { title: 'Unlinked from incident', detail: entry.actorId || entry.actorName ? `by ${actor}` : undefined }
    default:
      return { title: entry.note ?? entry.type }
  }
}

const COLLAPSED_COUNT = 5

export function AlertHistoryTimeline({
  history,
  accountLabels,
  filter = 'all',
}: {
  history: AlertHistoryEntry[]
  accountLabels: Map<string, string>
  filter?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const activeFilter = HISTORY_FILTERS.find((f) => f.key === filter)
  const filtered = activeFilter?.types ? history.filter((h) => activeFilter.types!.includes(h.type)) : history
  const sorted = [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_COUNT)

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No {activeFilter && activeFilter.key !== 'all' ? `${activeFilter.label.toLowerCase()} ` : ''}history yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {visible.map((entry, i) => {
        const meta = HISTORY_TYPE_META[entry.type] ?? DEFAULT_META
        const Icon = meta.icon
        const isLast = i === visible.length - 1
        const { title, detail } = describeHistory(entry, accountLabels)
        return (
          <div key={`${entry.type}-${entry.timestamp}-${i}`} className="flex gap-3">
            <div className="flex w-7 flex-col items-center">
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
              >
                <Icon className="size-[15px]" />
              </div>
              {!isLast && <div className="min-h-6 w-0.5 flex-1 bg-border" />}
            </div>
            <div className="flex min-w-0 flex-1 items-start justify-between pb-4">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{title}</p>
                {detail && <p className="break-words text-xs text-muted-foreground">{detail}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end pl-2">
                <p className="text-xs text-muted-foreground">{dayjs(entry.timestamp).fromNow()}</p>
                <p className="text-xs text-muted-foreground/70">{dayjs(entry.timestamp).format('h:mm A')}</p>
              </div>
            </div>
          </div>
        )
      })}
      {sorted.length > COLLAPSED_COUNT && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'View full activity timeline →'}
        </Button>
      )}
    </div>
  )
}

// Sized so exactly 5 single-line notes are visible before the list scrolls.
const NOTES_VISIBLE_COUNT = 5
const NOTE_ROW_HEIGHT = 64

function NoteRow({ alertId, note, canManage }: { alertId: string; note: AlertNote; canManage: boolean }) {
  const editNote = useEditAlertNoteMutation()
  const deleteNote = useDeleteAlertNoteMutation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.text)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSaveEdit() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === note.text) {
      setEditing(false)
      return
    }
    try {
      await editNote.mutateAsync({ id: alertId, noteId: note.id, text: trimmed })
      setEditing(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    try {
      await deleteNote.mutateAsync({ id: alertId, noteId: note.id })
      setConfirmDelete(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent">
      <UserAvatar name={note.authorName} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold">{note.authorName}</span>
          <span className="text-xs text-muted-foreground">{dayjs(note.createdAt).fromNow()}</span>
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={editNote.isPending}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(note.text)
                  setEditing(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="break-words text-sm">{note.text}</p>
        )}
      </div>
      {canManage && !editing && (
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} title="Edit note">
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setConfirmDelete(true)} title="Delete note">
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteNote.isPending}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

/** Renders its own Card (icon header, composer, list) rather than being wrapped in the
 *  page's generic Section, so it can carry the note-count badge and sort control in its
 *  header — matching the richer reference design instead of a plain title bar. */
export function NotesPanel({
  alertId,
  notes,
  innerRef,
  scrollMarginTop,
}: {
  alertId: string
  notes: AlertNote[]
  innerRef?: RefObject<HTMLDivElement | null>
  scrollMarginTop?: number
}) {
  const currentUser = useAppSelector((s) => s.session.user)
  const addNote = useAddAlertNoteMutation()
  const [text, setText] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || !currentUser) return
    setText('')
    try {
      await addNote.mutateAsync({ id: alertId, authorName: currentUser.name, text: trimmed })
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const sorted = [...notes].sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    return sortOrder === 'newest' ? diff : -diff
  })

  return (
    <Card ref={innerRef} style={{ scrollMarginTop }}>
      <CardContent>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded bg-[#6d95e01f] text-[#6d95e0]">
              <MessageCircle className="size-[13px]" />
            </span>
            <p className="text-sm font-semibold">Notes</p>
            <Badge variant="secondary" className="h-5">
              {notes.length}
            </Badge>
          </div>
          {notes.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Sort:</span>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}>
                <SelectTrigger size="sm" className="border-none font-semibold shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="mb-4 flex gap-2">
          <Input
            placeholder="Add a note…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="rounded-full"
          />
          <Button size="icon" aria-label="Add note" onClick={handleSend} disabled={!text.trim() || addNote.isPending}>
            <Send className="size-4" />
          </Button>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <div className="flex flex-col gap-1 overflow-y-auto pr-1" style={{ maxHeight: NOTES_VISIBLE_COUNT * NOTE_ROW_HEIGHT }}>
            {sorted.map((note) => (
              <NoteRow
                key={note.id}
                alertId={alertId}
                note={note}
                canManage={!!currentUser && (currentUser.id === note.authorId || currentUser.role === 'ADMIN')}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
