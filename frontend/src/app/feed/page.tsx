'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { useSocket } from '@/hooks/useSocket'
import { getFeed, type FeedEvent } from '@/lib/api'
import { formatAddress, timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'

type FeedTab = 'all' | 'predictions' | 'scores' | 'achievements'

const TAB_LABELS: { key: FeedTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'predictions', label: 'Predictions' },
  { key: 'scores', label: 'Score Changes' },
  { key: 'achievements', label: 'Achievements' },
]

function addressColor(address: string): string {
  const hash = address.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const colors = [
    'bg-purple-600', 'bg-blue-600', 'bg-green-600', 'bg-pink-600',
    'bg-yellow-600', 'bg-indigo-600', 'bg-teal-600', 'bg-orange-600',
  ]
  return colors[hash % colors.length]
}

function eventIcon(type: FeedEvent['type']): string {
  const icons: Record<FeedEvent['type'], string> = {
    prediction_opened: '📊',
    prediction_resolved: '✅',
    tier_changed: '⬆️',
    badge_earned: '🏅',
    score_jump: '🚀',
  }
  return icons[type] ?? '•'
}

function eventDescription(event: FeedEvent): string {
  const actor = formatAddress(event.actor)
  switch (event.type) {
    case 'prediction_opened':
      return `${actor} opened a prediction on "${String(event.data.marketTitle ?? 'a market')}"`
    case 'prediction_resolved':
      return `${actor} ${event.data.result === 'won' ? 'won' : 'resolved'} prediction on "${String(event.data.marketTitle ?? 'a market')}"`
    case 'tier_changed':
      return `${actor} advanced to ${String(event.data.newTier ?? 'a new')} tier`
    case 'badge_earned':
      return `${actor} earned the "${String(event.data.badgeName ?? 'Unknown')}" badge`
    case 'score_jump':
      return `${actor} jumped +${String(event.data.delta ?? '?')} score points`
    default:
      return `${actor} did something`
  }
}

function tabFilter(tab: FeedTab, event: FeedEvent): boolean {
  if (tab === 'all') return true
  if (tab === 'predictions') return event.type === 'prediction_opened' || event.type === 'prediction_resolved'
  if (tab === 'scores') return event.type === 'score_jump' || event.type === 'tier_changed'
  if (tab === 'achievements') return event.type === 'badge_earned' || event.type === 'tier_changed'
  return true
}

export default function FeedPage() {
  const { address, isConnected } = useAccount()
  const socketRef = useSocket()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [tab, setTab] = useState<FeedTab>('all')
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const lastViewedRef = useRef<number>(
    typeof window !== 'undefined'
      ? parseInt(sessionStorage.getItem('feed_last_viewed') ?? '0', 10)
      : 0
  )

  // Load initial feed
  useEffect(() => {
    async function load() {
      setLoading(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('tyche_token') ?? '' : ''
      const data = await getFeed(token)
      setEvents(data)
      setLoading(false)
    }
    load()
  }, [])

  // Socket live updates
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const handleConnect = () => setIsLive(true)
    const handleDisconnect = () => setIsLive(false)

    const handleFeedEvent = (event: FeedEvent) => {
      setEvents((prev) => [{ ...event, id: event.id ?? String(Date.now()) }, ...prev])
      setUnread((n) => n + 1)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('feed:event', handleFeedEvent)
    if (socket.connected) setIsLive(true)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('feed:event', handleFeedEvent)
    }
  }, [socketRef])

  // Mark as viewed
  useEffect(() => {
    const now = Date.now()
    sessionStorage.setItem('feed_last_viewed', String(now))
    lastViewedRef.current = now
    setUnread(0)
  }, [])

  const filtered = events.filter((e) => tabFilter(tab, e))

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">Feed</h1>
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 rounded-full bg-gray-900 border border-gray-800 px-3 py-1">
              <div className={cn(
                'w-2 h-2 rounded-full',
                isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
              )} />
              <span className="text-xs text-gray-400">{isLive ? 'Live' : 'Offline'}</span>
            </div>
            {unread > 0 && (
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-xs font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
        </div>

        {/* Connect prompt if not connected */}
        {!isConnected && (
          <div className="rounded-xl border border-purple-800/40 bg-purple-900/10 p-4 flex items-center justify-between">
            <p className="text-sm text-purple-300">Connect wallet to see your personalized feed</p>
            <span className="text-xs text-gray-500">Showing public events</span>
          </div>
        )}

        {/* Tab filters */}
        <div className="flex gap-1 rounded-xl bg-gray-900 p-1 border border-gray-800">
          {TAB_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors',
                tab === key ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Feed list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 py-16 text-center space-y-3">
            <p className="text-gray-500">No activity in feed yet.</p>
            <Link href="/explore" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
              Find predictors to follow →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((event, idx) => (
              <div
                key={event.id ?? idx}
                className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all duration-300 hover:border-gray-700"
                style={{
                  animation: idx === 0 && unread > 0 ? 'feedSlideIn 0.3s ease-out' : undefined,
                }}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${addressColor(event.actor)}`}
                >
                  {event.actor.slice(2, 4).toUpperCase()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm text-gray-200">
                    <span className="mr-2">{eventIcon(event.type)}</span>
                    {eventDescription(event)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {timeAgo(event.timestamp * 1000)} ·{' '}
                    <Link href={`/profile/${event.actor}`} className="hover:text-purple-400 transition-colors">
                      {formatAddress(event.actor)}
                    </Link>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes feedSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
