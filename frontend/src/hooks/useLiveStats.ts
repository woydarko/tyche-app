'use client'

import { useState, useEffect, useCallback } from 'react'
import { getLiveStats, type LiveStats } from '@/lib/api'
import { useSocket } from './useSocket'

const DEFAULT_STATS: LiveStats = {
  totalPredictors: 0,
  marketsResolvedToday: 0,
  predictionsScored: 0,
}

export function useLiveStats() {
  const [stats, setStats] = useState<LiveStats>(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)
  const socketRef = useSocket()

  const fetchStats = useCallback(async () => {
    try {
      const data = await getLiveStats()
      setStats(data)
    } catch (err) {
      console.error('[useLiveStats] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const handleStatsUpdate = (data: LiveStats) => {
      setStats(data)
    }

    socket.on('stats:updated', handleStatsUpdate)
    return () => {
      socket.off('stats:updated', handleStatsUpdate)
    }
  }, [socketRef])

  return { stats, loading }
}
