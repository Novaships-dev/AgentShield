'use client'

import { useState, useCallback } from 'react'
import GlassCard from '@/components/ui/GlassCard'
import { Activity } from 'lucide-react'
import type { LiveEvent } from '@/types/analytics'
import { useWebSocket } from '@/hooks/useWebSocket'

function formatCost(usd: number) {
  if (usd >= 1) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(6)}`
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

interface EventRowProps {
  event: LiveEvent & { _isNew?: boolean }
}

function EventRow({ event }: EventRowProps) {
  const statusColor =
    event.status === 'success' ? '#10b981'
    : event.status === 'error' ? '#ef4444'
    : 'var(--text-muted)'

  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-300"
      style={{
        background: event._isNew ? 'rgba(124,58,237,0.08)' : 'transparent',
        animation: event._isNew ? 'slideInFromTop 0.3s ease-out' : undefined,
      }}
    >
      {/* Status dot */}
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: statusColor }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {event.agent}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {event.model?.split('-').slice(0, 2).join('-') ?? 'unknown'}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(event.tracked_at)}
        </span>
      </div>

      <span
        className="text-sm font-mono font-medium flex-shrink-0"
        style={{ color: 'var(--accent2)' }}
      >
        {formatCost(event.cost_usd)}
      </span>
    </div>
  )
}

export default function LiveFeed() {
  const [events, setEvents] = useState<(LiveEvent & { _isNew?: boolean })[]>([])

  const handleNewEvent = useCallback((rawData: unknown) => {
    const event = rawData as LiveEvent
    setEvents(prev => {
      const newEvent = { ...event, _isNew: true }
      const updated = [newEvent, ...prev].slice(0, 20)
      // Clear _isNew after animation
      setTimeout(() => {
        setEvents(curr =>
          curr.map(e => e.event_id === event.event_id ? { ...e, _isNew: false } : e)
        )
      }, 2000)
      return updated
    })
  }, [])

  useWebSocket('new_event', handleNewEvent)

  return (
    <GlassCard className="flex flex-col" style={{ padding: 0 }}>
      <style>{`
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <Activity className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Live Events
        </span>
        {events.length > 0 && (
          <span
            className="ml-auto text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {events.length} recent
          </span>
        )}
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '340px' }}>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.1)' }}
            >
              <Activity className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                No events yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Events will appear here in real time as your agents make API calls.
              </p>
            </div>
          </div>
        ) : (
          events.map(event => (
            <EventRow key={event.event_id} event={event} />
          ))
        )}
      </div>
    </GlassCard>
  )
}
