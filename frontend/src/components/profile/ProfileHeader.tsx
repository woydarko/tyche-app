'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { type ProfileData } from '@/lib/api'
import { formatScore, tierColor } from '@/lib/utils'
import TierBadge from '@/components/ui/TierBadge'
import AddressDisplay from '@/components/ui/AddressDisplay'

interface ProfileHeaderProps {
  profile: ProfileData
  address: string
}

function ScoreRing({ score, tier }: { score: number; tier: number }) {
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const percentage = Math.min(score / 10000, 1)
  const offset = circumference * (1 - percentage)
  const color = tierColor(tier)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="120" className="-rotate-90">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
        />
        {/* Score arc */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 6px ${color})`,
            transition: 'stroke-dashoffset 1s ease-in-out',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-white leading-none">
          {formatScore(score)}
        </span>
        <span className="text-xs text-gray-400 mt-0.5">Score</span>
      </div>
    </div>
  )
}

export default function ProfileHeader({ profile, address }: ProfileHeaderProps) {
  const { address: connectedAddress } = useAccount()
  const isOwn = connectedAddress?.toLowerCase() === address.toLowerCase()
  const [following, setFollowing] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/profile/${address}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const avatarHue = parseInt(address.slice(2, 8), 16) % 360

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-start gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-white"
            style={{ background: `hsl(${avatarHue}, 65%, 40%)` }}
          >
            {address.slice(2, 4).toUpperCase()}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white font-mono">
              <AddressDisplay address={address} chars={6} showCopy explorerUrl />
            </h1>
            {isOwn && (
              <span className="rounded-full bg-purple-950 border border-purple-500/30 px-2 py-0.5 text-xs text-purple-300 font-medium">
                You
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <TierBadge tier={profile.tier} size="md" />
            <span className="text-sm text-gray-500">
              {profile.seasonsActive} season{profile.seasonsActive !== 1 ? 's' : ''} active
            </span>
            {profile.bestCategory && (
              <span className="text-sm text-gray-500">
                Best: <span className="text-purple-400">{profile.bestCategory}</span>
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!isOwn && (
              <button
                onClick={() => setFollowing(!following)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  following
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-purple-600 text-white hover:bg-purple-500'
                }`}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            )}
            <button
              onClick={handleShare}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share Profile
                </>
              )}
            </button>
            <a
              href={`https://shannon-explorer.somnia.network/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Explorer
            </a>
          </div>
        </div>

        {/* Score Ring */}
        <div className="flex-shrink-0">
          <ScoreRing score={profile.compositeScore} tier={profile.tier} />
        </div>
      </div>
    </div>
  )
}
