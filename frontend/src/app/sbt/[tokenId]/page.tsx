'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getSBTById, getProfile, type SBTData, type ProfileData } from '@/lib/api'
import SBTVisual from '@/components/sbt/SBTVisual'
import TierBadge from '@/components/ui/TierBadge'
import { TIER_NAMES, TIER_COLORS, SCORE_DIMENSIONS } from '@/lib/constants'
import { formatAddress } from '@/lib/utils'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="ml-2 text-xs text-gray-500 hover:text-purple-400 transition-colors"
      title="Copy address"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min((value / 10000) * 100, 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function SBTPage() {
  const params = useParams()
  const tokenId = params.tokenId as string

  const [sbt, setSbt] = useState<SBTData | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const sbtData = await getSBTById(tokenId)
      setSbt(sbtData)
      if (sbtData?.owner) {
        const profileData = await getProfile(sbtData.owner)
        setProfile(profileData)
      }
      setLoading(false)
    }
    if (tokenId) load()
  }, [tokenId])

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: `Tyche SBT #${tokenId}`, url })
    } else {
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Loading SBT #{tokenId}...</p>
        </div>
      </div>
    )
  }

  if (!sbt) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl">🔮</div>
          <h1 className="text-2xl font-bold text-white">SBT Not Found</h1>
          <p className="text-gray-400">Token #{tokenId} does not exist or hasn&apos;t been indexed yet.</p>
          <Link href="/leaderboard" className="inline-block text-purple-400 hover:text-purple-300 transition-colors">
            ← Back to Leaderboard
          </Link>
        </div>
      </div>
    )
  }

  const tierColor = TIER_COLORS[Math.min(sbt.tier, 4)]
  const tierName = TIER_NAMES[Math.min(sbt.tier, 4)]
  const mintDate = new Date(sbt.mintedAt * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const evolvedDate = new Date(sbt.lastEvolvedAt * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const dimensionScores = profile
    ? [
        { label: 'Accuracy', value: profile.accuracyScore, color: '#a78bfa' },
        { label: 'Alpha', value: profile.alphaScore, color: '#34d399' },
        { label: 'Calibration', value: profile.calibrationScore, color: '#60a5fa' },
        { label: 'Consistency', value: profile.consistencyScore, color: '#f472b6' },
        { label: 'Composite', value: profile.compositeScore, color: tierColor },
      ]
    : []

  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Back link */}
        <Link href="/leaderboard" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          ← Leaderboard
        </Link>

        {/* Main card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
          {/* Header band */}
          <div
            className="h-2 w-full"
            style={{ background: `linear-gradient(90deg, ${tierColor}66, ${tierColor})` }}
          />

          <div className="p-8 space-y-8">
            {/* SBT Visual */}
            <div className="flex flex-col items-center gap-4">
              <SBTVisual tier={sbt.tier} size={220} />
              <div className="text-center space-y-1">
                <p className="text-xs text-gray-500 font-mono">TYCHE SOULBOUND TOKEN</p>
                <p className="text-2xl font-bold text-white font-mono">#{tokenId}</p>
                <TierBadge tier={sbt.tier} size="lg" />
              </div>
            </div>

            {/* Owner details */}
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-5 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Token Details</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Owner</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm text-white">{formatAddress(sbt.owner)}</span>
                    <CopyButton value={sbt.owner} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Tier</span>
                  <span className="font-semibold" style={{ color: tierColor }}>{tierName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Minted</span>
                  <span className="text-sm text-white">{mintDate}</span>
                </div>
                {sbt.lastEvolvedAt > sbt.mintedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Last Evolved</span>
                    <span className="text-sm text-white">{evolvedDate}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Evolution Count</span>
                  <span className="text-sm font-semibold text-purple-400">{sbt.evolvedCount}x</span>
                </div>
              </div>
            </div>

            {/* Score dimensions */}
            {profile && dimensionScores.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-950 p-5 space-y-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Tyche Score Breakdown</h3>
                <div className="space-y-3">
                  {dimensionScores.map((d) => (
                    <ScoreBar key={d.label} label={d.label} value={d.value} color={d.color} />
                  ))}
                </div>
              </div>
            )}

            {/* Badges */}
            {profile?.badges && profile.badges.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-950 p-5 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Season Badges</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-center gap-2 rounded-full bg-gray-800 px-3 py-1.5 text-sm"
                      title={badge.description}
                    >
                      <span>{badge.icon}</span>
                      <span className="text-gray-300">{badge.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`https://shannon-explorer.somnia.network/address/${sbt.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-5 py-3 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Verify On-Chain
              </a>

              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-purple-800 bg-purple-900/30 px-5 py-3 text-sm font-medium text-purple-300 hover:bg-purple-900/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {shared ? 'Link Copied!' : 'Share SBT'}
              </button>

              <Link
                href={`/profile/${sbt.owner}`}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-purple-600 bg-purple-600 px-5 py-3 text-sm font-medium text-white hover:bg-purple-500 transition-colors"
              >
                View Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
