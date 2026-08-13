import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import * as analyticsApi from '@/api/analytics'
import type { MetricsSummaryResponse } from '@/api/analytics'
import { useAppSelector } from '@/app/hooks'

const summaryKey = ['analytics', 'summary'] as const

export function useMetricsSummaryQuery() {
  return useQuery({ queryKey: summaryKey, queryFn: analyticsApi.getMetricsSummary })
}

/** GET /api/analytics/stream is real Server-Sent Events from the gateway, but the
 *  browser's EventSource API can't attach an Authorization header — every other
 *  request in this app is authenticated that way, and unlike the chat WebSocket route
 *  the gateway has no query-param token fallback for this endpoint. A manual fetch +
 *  ReadableStream reader gets the same live stream while still sending a normal bearer
 *  header, at the cost of hand-rolling the "event:/data:" frame parsing EventSource
 *  would otherwise do. */
export function useLiveMetrics() {
  const token = useAppSelector((s) => s.session.token)
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    let cancelled = false

    async function connect() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/analytics/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        })
        if (!response.body) return
        setConnected(true)
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!cancelled) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const frames = buffer.split('\n\n')
          buffer = frames.pop() ?? ''
          for (const frame of frames) {
            const dataLine = frame.split('\n').find((l) => l.startsWith('data:'))
            if (!dataLine) continue // heartbeat comment, or an event without a payload
            try {
              const payload = JSON.parse(dataLine.slice(5).trim()) as MetricsSummaryResponse
              queryClient.setQueryData(summaryKey, payload)
            } catch {
              // malformed frame — skip it, the next heartbeat/event will resync
            }
          }
        }
      } catch {
        // connection dropped or aborted — fall through to the retry below
      } finally {
        setConnected(false)
      }
      if (!cancelled) retryTimer = window.setTimeout(connect, 5000)
    }

    let retryTimer = window.setTimeout(connect, 0)
    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
      controller.abort()
    }
  }, [token, queryClient])

  return { connected }
}
