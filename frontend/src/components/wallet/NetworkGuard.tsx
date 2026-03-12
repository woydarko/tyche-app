'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { getProfile, type ProfileData } from '@/lib/api'
import { SOMNIA_CHAIN_ID } from '@/lib/constants'
import { formatScore } from '@/lib/utils'
import TierBadge from '@/components/ui/TierBadge'

export default function NetworkGuard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isWrongNetwork = isConnected && chainId !== SOMNIA_CHAIN_ID

  useEffect(() => {
    if (!address || !isConnected || isWrongNetwork) {
      setProfile(null)
      setShowPreview(false)
      return
    }

    const fetchProfile = async () => {
      const data = await getProfile(address)
      if (data) {
        setProfile(data)
        setIsNewUser(false)
        setShowPreview(true)
      } else {
        setIsNewUser(true)
        setShowPreview(true)
      }
      setDismissed(false)
    }

    fetchProfile()
  }, [address, isConnected, isWrongNetwork])

  if (!isConnected) return null
  if (dismissed) return null

  // Wrong network banner
  if (isWrongNetwork) {
    return (
      <div className="fixed top-16 left-0 right-0 z-40 flex items-center justify-center px-4 pt-2">
        <div className="w-full max-w-2xl rounded-xl border border-red-500/30 bg-red-950/80 backdrop-blur-md px-5 py-3 flex items-center gap-4 shadow-xl">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-200 flex-1">
            <span className="font-semibold">Wrong network detected.</span> Tyche runs on Somnia Testnet (Chain ID: 50312).
          </p>
          <button
            onClick={() => switchChain({ chainId: SOMNIA_CHAIN_ID })}
            className="flex-shrink-0 rounded-lg bg-red-500 hover:bg-red-400 px-4 py-1.5 text-sm font-semibold text-white transition-colors"
          >
            Switch to Somnia
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 text-red-400 hover:text-red-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // Score preview / onboarding card
  if (showPreview && address) {
    return (
      <div className="fixed top-16 right-4 z-40 w-80">
        <div className="rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-md p-5 shadow-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{
                  background: `hsl(${parseInt(address.slice(2, 8), 16) % 360}, 65%, 45%)`,
                }}
              >
                {address.slice(2, 4).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-white font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </div>
                <div className="text-xs text-gray-400">Connected</div>
              </div>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isNewUser ? (
            <div>
              <div className="text-center py-3">
                <div className="text-2xl mb-2">👋</div>
                <h3 className="font-bold text-white text-base mb-1">Welcome to Tyche!</h3>
                <p className="text-sm text-gray-400">
                  You don't have a score yet. Start predicting on Somnia markets to build your reputation.
                </p>
              </div>
              <a
                href="/leaderboard"
                className="block w-full text-center mt-4 rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                Explore the Protocol
              </a>
            </div>
          ) : profile ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <TierBadge tier={profile.tier} />
                <span className="text-xs text-gray-400">Your rank</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatScore(profile.compositeScore)}
              </div>
              <div className="text-xs text-gray-400 mb-4">Composite Score</div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className="rounded-lg bg-gray-800 p-2">
                  <div className="text-gray-400">Win Rate</div>
                  <div className="font-semibold text-green-400">
                    {(profile.winRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-lg bg-gray-800 p-2">
                  <div className="text-gray-400">Predictions</div>
                  <div className="font-semibold text-white">{profile.totalPredictions}</div>
                </div>
              </div>
              <a
                href={`/profile/${address}`}
                className="block w-full text-center rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                View Full Profile
              </a>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return null
}
