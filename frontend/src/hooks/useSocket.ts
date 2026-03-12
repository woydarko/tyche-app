'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { API_URL } from '@/lib/constants'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    socketRef.current = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current.on('connect', () => {
      console.log('[Tyche] Socket connected:', socketRef.current?.id)
    })

    socketRef.current.on('disconnect', () => {
      console.log('[Tyche] Socket disconnected')
    })

    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  return socketRef
}

// Subscribe to a specific socket event with cleanup
export function useSocketEvent<T = unknown>(
  socketRef: ReturnType<typeof useSocket>,
  event: string,
  handler: (data: T) => void
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const fn = (data: T) => handlerRef.current(data)
    socket.on(event, fn)
    return () => {
      socket.off(event, fn)
    }
  }, [socketRef, event])
}

// Socket event names used across the app
export const SOCKET_EVENTS = {
  FEED_EVENT: 'feed:event',
  TIER_CHANGED: 'tier:changed',
  SBT_EVOLVED: 'sbt:evolved',
  SEASON_WARNING: 'season:warning',
  LEADERBOARD_UPDATE: 'leaderboard:update',
  SCORE_UPDATE: 'score:update',
} as const
