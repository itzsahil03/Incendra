import { useQuery } from '@tanstack/react-query'
import * as notificationsApi from '@/api/notifications'

// No push mechanism exists for this feed (unlike analytics' SSE stream) — short polling
// is the honest way to keep it "live" without fabricating a websocket the backend doesn't have.
const REFETCH_MS = 15_000

export function useNotificationsQuery() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.listNotifications,
    refetchInterval: REFETCH_MS,
  })
}

export function useMyNotificationsQuery() {
  return useQuery({
    queryKey: ['notifications', 'mine'],
    queryFn: notificationsApi.listMyNotifications,
    refetchInterval: REFETCH_MS,
  })
}

export function useUnreadNotificationsCountQuery() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: REFETCH_MS,
  })
}
