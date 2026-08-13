import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import * as chatApi from '@/api/chat'
import type { ChatMessageResponse } from '@/api/chat'
import { useAppSelector } from '@/app/hooks'

function messagesKey(incidentId: string) {
  return ['chat', incidentId] as const
}

export function useChatMessagesQuery(incidentId: string | undefined) {
  return useQuery({
    queryKey: messagesKey(incidentId ?? ''),
    queryFn: () => chatApi.listMessages(incidentId!),
    enabled: !!incidentId,
  })
}

export function usePostMessageMutation(incidentId: string) {
  const queryClient = useQueryClient()
  const userName = useAppSelector((s) => s.session.user?.name)
  return useMutation({
    mutationFn: (text: string) => chatApi.postMessage(incidentId, text, userName ?? 'Unknown user'),
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessageResponse[]>(messagesKey(incidentId), (prev) =>
        prev?.some((m) => m.id === message.id) ? prev : [...(prev ?? []), message],
      )
    },
  })
}

/** Raw WebSocket (not STOMP) — the gateway only accepts the token via ?token= for this
 *  route since a browser WS handshake can't carry an Authorization header at all (see
 *  GatewayJwtFilter#filterWebSocketUpgrade). Server push only; sending a message still
 *  goes through the normal POST above. */
export function useChatSocket(incidentId: string | undefined) {
  const token = useAppSelector((s) => s.session.token)
  const queryClient = useQueryClient()
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!incidentId || !token) return

    const base = import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')
    const socket = new WebSocket(`${base}/api/ws/incidents/${incidentId}?token=${encodeURIComponent(token)}`)
    socketRef.current = socket

    socket.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data) as { type: string; message: ChatMessageResponse }
        if (frame.type === 'message') {
          queryClient.setQueryData<ChatMessageResponse[]>(messagesKey(incidentId), (prev) =>
            prev?.some((m) => m.id === frame.message.id) ? prev : [...(prev ?? []), frame.message],
          )
        }
      } catch {
        // not a frame we understand — ignore
      }
    }

    return () => socket.close()
  }, [incidentId, token, queryClient])
}
