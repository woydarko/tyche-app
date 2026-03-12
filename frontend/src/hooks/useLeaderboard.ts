'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api'
import { useSocket } from './useSocket'

export interface LeaderboardEntryWithFlash extends LeaderboardEntry {
  flash?: boolean
}

export function useLeaderboard(sort = 'composite', season?: number) {
  const [entries, setEntries] = useState<LeaderboardEntryWithFlash[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const socketRef = useSocket()
  const flashTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const fetchData = useCallback(async () => {
    try {
      const data = await getLeaderboard(100, sort, season)
      setEntries(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('[useLeaderboard] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [sort, season])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const handleReorder = (data: LeaderboardEntry[]) => {
      setEntries(data)
      setLastUpdated(new Date())
    }

    const handleScoreUpdate = (data: { address: string; scores: Partial<LeaderboardEntry> }) => {
      setEntries((prev) => {
        const updated = prev.map((entry) => {
          if (entry.address.toLowerCase() === data.address.toLowerCase()) {
            return { ...entry, ...data.scores, flash: true }
          }
          return entry
        })
        return updated
      })
      setLastUpdated(new Date())

      // Clear flash after 1s
      const existing = flashTimeouts.current.get(data.address)
      if (existing) clearTimeout(existing)
      const timeout = setTimeout(() => {
        setEntries((prev) =>
          prev.map((entry) =>
            entry.address.toLowerCase() === data.address.toLowerCase()
              ? { ...entry, flash: false }
              : entry
          )
        )
        flashTimeouts.current.delete(data.address)
      }, 1000)
      flashTimeouts.current.set(data.address, timeout)
    }

    socket.on('leaderboard:reorder', handleReorder)
    socket.on('score:updated', handleScoreUpdate)

    return () => {
      socket.off('leaderboard:reorder', handleReorder)
      socket.off('score:updated', handleScoreUpdate)
    }
  }, [socketRef])

  useEffect(() => {
    return () => {
      flashTimeouts.current.forEach((t) => clearTimeout(t))
    }
  }, [])

  return { entries, loading, lastUpdated, refetch: fetchData }
}
