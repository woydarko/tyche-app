'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSocket, SOCKET_EVENTS } from '@/hooks/useSocket'

export type NotificationType = 'tier_changed' | 'sbt_evolved' | 'season_warning'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  timestamp: number
}

interface TierChangedPayload {
  newTier?: string | number
  address?: string
}

interface SBTEvolvedPayload {
  tokenId?: string
  tier?: number
}

interface SeasonWarningPayload {
  hoursLeft?: number
  seasonName?: string
}

export function useNotifications() {
  const socketRef = useSocket()
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((type: NotificationType, message: string) => {
    const n: Notification = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      timestamp: Date.now(),
    }
    setNotifications((prev) => [...prev, n])
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const handleTierChanged = (data: TierChangedPayload) => {
      const tierLabel = data.newTier ?? 'a new tier'
      addNotification('tier_changed', `Tier upgraded to ${tierLabel}!`)
    }

    const handleSBTEvolved = (data: SBTEvolvedPayload) => {
      addNotification('sbt_evolved', `Your SBT evolved!${data.tokenId ? ` Token #${data.tokenId}` : ''}`)
    }

    const handleSeasonWarning = (data: SeasonWarningPayload) => {
      const hours = data.hoursLeft ?? 48
      const name = data.seasonName ? ` "${data.seasonName}"` : ''
      addNotification('season_warning', `Season${name} ends in ${hours}h!`)
    }

    socket.on(SOCKET_EVENTS.TIER_CHANGED, handleTierChanged)
    socket.on(SOCKET_EVENTS.SBT_EVOLVED, handleSBTEvolved)
    socket.on(SOCKET_EVENTS.SEASON_WARNING, handleSeasonWarning)

    return () => {
      socket.off(SOCKET_EVENTS.TIER_CHANGED, handleTierChanged)
      socket.off(SOCKET_EVENTS.SBT_EVOLVED, handleSBTEvolved)
      socket.off(SOCKET_EVENTS.SEASON_WARNING, handleSeasonWarning)
    }
  }, [socketRef, addNotification])

  return { notifications, dismissNotification, clearAll }
}
