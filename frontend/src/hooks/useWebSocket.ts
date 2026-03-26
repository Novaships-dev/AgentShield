'use client'

import { useEffect } from 'react'
import { useWebSocketContext } from '@/components/providers/WebSocketProvider'

/**
 * Subscribe to a specific WebSocket event type.
 *
 * Usage:
 *   useWebSocket('new_event', (data) => { ... })
 */
export function useWebSocket(type: string, handler: (data: unknown) => void) {
  const { addListener, removeListener } = useWebSocketContext()

  useEffect(() => {
    addListener(type, handler)
    return () => removeListener(type, handler)
  }, [type, handler, addListener, removeListener])
}
