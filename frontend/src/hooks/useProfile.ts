'use client'

import { useState, useEffect, useCallback } from 'react'
import { getProfile, getProfileHistory, type ProfileData, type Prediction } from '@/lib/api'

export function useProfile(address: string | undefined) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!address) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [profileData, historyData] = await Promise.all([
        getProfile(address),
        getProfileHistory(address, 20),
      ])
      setProfile(profileData)
      setPredictions(historyData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return { profile, predictions, loading, error, refetch: fetchProfile }
}
