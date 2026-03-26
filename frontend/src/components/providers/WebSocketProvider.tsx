'use client'

import { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type WsMessage = { type: string; data?: unknown }
type Listener = (data: unknown) => void

interface WebSocketContextValue {
  isConnected: boolean
  addListener: (type: string, fn: Listener) => void
  removeListener: (type: string, fn: Listener) => void
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  addListener: () => {},
  removeListener: () => {},
})

export function useWebSocketContext() {
  return useContext(WebSocketContext)
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/dashboard'
const MAX_BACKOFF = 30_000
const MAX_RETRIES = 5
const FALLBACK_POLL_INTERVAL = 5_000

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryCount = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const listenersRef = useRef<Map<string, Set<Listener>>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const fallbackTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const useFallback = useRef(false)

  const dispatch = useCallback((msg: WsMessage) => {
    const fns = listenersRef.current.get(msg.type)
    if (fns) {
      fns.forEach(fn => fn(msg.data))
    }
  }, [])

  const addListener = useCallback((type: string, fn: Listener) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set())
    }
    listenersRef.current.get(type)!.add(fn)
  }, [])

  const removeListener = useCallback((type: string, fn: Listener) => {
    listenersRef.current.get(type)?.delete(fn)
  }, [])

  const startFallbackPolling = useCallback(() => {
    if (fallbackTimer.current) return
    useFallback.current = true
    fallbackTimer.current = setInterval(() => {
      // Emit a synthetic "poll" event so useAnalytics can refetch
      dispatch({ type: '_poll' })
    }, FALLBACK_POLL_INTERVAL)
  }, [dispatch])

  const stopFallbackPolling = useCallback(() => {
    if (fallbackTimer.current) {
      clearInterval(fallbackTimer.current)
      fallbackTimer.current = null
    }
    useFallback.current = false
  }, [])

  const connect = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const token = session.access_token

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        // Send auth handshake
        ws.send(JSON.stringify({ type: 'auth', token }))
      }

      ws.onmessage = event => {
        try {
          const msg: WsMessage = JSON.parse(event.data)
          if (msg.type === 'auth_ok') {
            setIsConnected(true)
            retryCount.current = 0
            stopFallbackPolling()
            // Heartbeat: respond to ping
          } else if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }))
          } else {
            dispatch(msg)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        // onclose will handle retry
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        if (pingTimer.current) {
          clearInterval(pingTimer.current)
          pingTimer.current = null
        }
        retryCount.current += 1
        if (retryCount.current > MAX_RETRIES) {
          startFallbackPolling()
          return
        }
        const backoff = Math.min(1000 * 2 ** (retryCount.current - 1), MAX_BACKOFF)
        retryTimer.current = setTimeout(connect, backoff)
      }
    } catch {
      retryCount.current += 1
      if (retryCount.current > MAX_RETRIES) {
        startFallbackPolling()
      } else {
        const backoff = Math.min(1000 * 2 ** (retryCount.current - 1), MAX_BACKOFF)
        retryTimer.current = setTimeout(connect, backoff)
      }
    }
  }, [dispatch, startFallbackPolling, stopFallbackPolling])

  useEffect(() => {
    connect()
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
      if (pingTimer.current) clearInterval(pingTimer.current)
      if (fallbackTimer.current) clearInterval(fallbackTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return (
    <WebSocketContext.Provider value={{ isConnected, addListener, removeListener }}>
      {children}
    </WebSocketContext.Provider>
  )
}
