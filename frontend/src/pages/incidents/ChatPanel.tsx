import { useState } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/common/LoadingState'
import { UserAvatar } from '@/components/common/UserAvatar'
import { useChatMessagesQuery, useChatSocket, usePostMessageMutation } from '@/queries/useChat'
import { useAllUsersQuery } from '@/queries/useUsers'
import { useAppSelector } from '@/app/hooks'
import { getErrorMessage } from '@/lib/errors'
import dayjs from '@/lib/dayjs'

// Sized so roughly 5 messages are visible before the list scrolls — matches the Notes
// card's fixed-height scroll area on the Alert Detail page.
const MESSAGES_MAX_HEIGHT = 320

export function ChatPanel({ incidentId, filter = 'all' }: { incidentId: string; filter?: 'all' | 'comments' }) {
  const { data: messages, isLoading } = useChatMessagesQuery(incidentId)
  useChatSocket(incidentId)
  const postMessage = usePostMessageMutation(incidentId)
  const currentUserId = useAppSelector((s) => s.session.user?.id)
  const { data: accounts } = useAllUsersQuery()
  const [text, setText] = useState('')

  // Messages posted before the poster's name was sent to the backend were stored as
  // "anon" — fall back to a directory lookup by userId (including deactivated members,
  // tagged "(Deactivated)") so those display correctly too, and so a poster who has
  // since left the org still shows their name rather than "Unknown user".
  const nameById = new Map((accounts ?? []).map((a) => [a.id, a.active ? a.name : `${a.name} (Deactivated)`]))
  function resolveName(m: { userId: string | null; userName: string | null }) {
    if (m.userName && m.userName !== 'anon') return nameById.get(m.userId ?? '') ?? m.userName
    return (m.userId && nameById.get(m.userId)) || 'Unknown user'
  }

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    try {
      await postMessage.mutateAsync(trimmed)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (isLoading) return <LoadingState minHeight={160} />

  const visible = filter === 'comments' ? (messages ?? []).filter((m) => m.kind === 'user') : (messages ?? [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 overflow-y-auto pr-1" style={{ maxHeight: MESSAGES_MAX_HEIGHT }}>
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {filter === 'comments' ? 'No comments yet.' : 'No updates yet — be the first to comment.'}
          </p>
        )}
        {visible.map((m) =>
          m.kind === 'system' ? (
            <p key={m.id} className="py-1 text-center text-xs text-muted-foreground">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent">
              <UserAvatar name={resolveName(m)} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold">{m.userId === currentUserId ? 'You' : resolveName(m)}</span>
                  <span className="text-xs text-muted-foreground">{dayjs(m.createdAt).fromNow()}</span>
                </div>
                <p className="break-words text-sm">{m.text}</p>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Post an update…"
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
        <Button size="icon" aria-label="Send message" onClick={handleSend} disabled={!text.trim() || postMessage.isPending}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}
