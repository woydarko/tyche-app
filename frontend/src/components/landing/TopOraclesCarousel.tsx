'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getTop3, type LeaderboardEntry } from '@/lib/api'
import { formatAddress, formatScore } from '@/lib/utils'
import TierBadge from '@/components/ui/TierBadge'

function OracleCard({ entry }: { entry: LeaderboardEntry }) {
  return (
    <Link
      href={`/profile/${entry.address}`}
      className="flex-shrink-0 w-56 rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-purple-500/40 hover:bg-gray-800/80 transition-all group"
    >
      <div className="flex items-center gap-3 mb-4">
        {/* Jazzicon-style avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{
            background: `hsl(${parseInt(entry.address.slice(2, 8), 16) % 360}, 65%, 45%)`,
          }}
        >
          {entry.address.slice(2, 4).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white font-mono group-hover:text-purple-300 transition-colors">
            {formatAddress(entry.address)}
          </div>
          <div className="text-xs text-gray-500">Rank #{entry.rank}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <TierBadge tier={entry.tier} size="sm" />
      </div>
      <div className="text-2xl font-bold text-white mb-0.5">
        {formatScore(entry.compositeScore)}
      </div>
      <div className="text-xs text-gray-500">Composite Score</div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>Win Rate</span>
        <span className="text-green-400 font-medium">
          {(entry.winRate * 100).toFixed(1)}%
        </span>
      </div>
    </Link>
  )
}

// Placeholder cards for when data is loading/empty
function PlaceholderCard({ rank }: { rank: number }) {
  const mockData: LeaderboardEntry = {
    rank,
    address: `0x${rank.toString().repeat(40).slice(0, 40)}`,
    tier: Math.min(rank - 1, 4),
    compositeScore: Math.floor(9000 - rank * 500),
    accuracyScore: 8000,
    alphaScore: 7500,
    calibrationScore: 8500,
    consistencyScore: 7000,
    winRate: 0.75 - rank * 0.05,
    totalPredictions: 100 - rank * 10,
    pnl: 500 - rank * 100,
  }
  return <OracleCard entry={mockData} />
}

export default function TopOraclesCarousel() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTop3()
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [])

  const displayEntries = loading
    ? []
    : entries.length > 0
    ? entries
    : null

  return (
    <section className="py-20 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Top Oracles</h2>
            <p className="text-gray-400">The highest-scoring predictors on Somnia</p>
          </div>
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
          >
            View full leaderboard
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="relative">
          {loading ? (
            <div className="flex gap-4 overflow-x-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-shrink-0 w-56 h-44 rounded-xl border border-gray-800 bg-gray-900 animate-pulse" />
              ))}
            </div>
          ) : displayEntries === null ? (
            // Show placeholder data when backend is offline
            <div className="flex gap-4 overflow-x-auto pb-4">
              {[1, 2, 3].map((rank) => (
                <PlaceholderCard key={rank} rank={rank} />
              ))}
              <div className="flex-shrink-0 w-56 rounded-xl border border-dashed border-gray-700 p-5 flex flex-col items-center justify-center text-center">
                <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm text-gray-500">Be the next Oracle</p>
                <Link href="/leaderboard" className="mt-2 text-xs text-purple-400 hover:text-purple-300">
                  Join now →
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {displayEntries.map((entry) => (
                <OracleCard key={entry.address} entry={entry} />
              ))}
              <div className="flex-shrink-0 w-56 rounded-xl border border-dashed border-gray-700 p-5 flex flex-col items-center justify-center text-center">
                <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm text-gray-500">Could be you</p>
                <Link href="/leaderboard" className="mt-2 text-xs text-purple-400 hover:text-purple-300">
                  See rankings →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
