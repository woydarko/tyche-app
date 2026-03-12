'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { type LeaderboardEntryWithFlash } from '@/hooks/useLeaderboard'
import { formatAddress, formatScore, formatWinRate, formatPnL, tierColor } from '@/lib/utils'
import TierBadge from '@/components/ui/TierBadge'

interface LeaderboardTableProps {
  entries: LeaderboardEntryWithFlash[]
  loading: boolean
  lastUpdated: Date | null
  sort: string
}

function LiveIndicator({ lastUpdated }: { lastUpdated: Date | null }) {
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    if (!lastUpdated) return
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
      {lastUpdated
        ? `Last updated ${secondsAgo}s ago`
        : 'Connecting to live feed...'}
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-800 animate-pulse" style={{ width: `${40 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  )
}

export default function LeaderboardTable({
  entries,
  loading,
  lastUpdated,
  sort,
}: LeaderboardTableProps) {
  const { address: connectedAddress } = useAccount()

  const myEntry = connectedAddress
    ? entries.find((e) => e.address.toLowerCase() === connectedAddress.toLowerCase())
    : null

  const getScoreBySort = (entry: LeaderboardEntryWithFlash): number => {
    switch (sort) {
      case 'accuracy': return entry.accuracyScore
      case 'alpha': return entry.alphaScore
      case 'calibration': return entry.calibrationScore
      case 'consistency': return entry.consistencyScore
      case 'pnl': return entry.pnl
      default: return entry.compositeScore
    }
  }

  const getSortLabel = (): string => {
    switch (sort) {
      case 'accuracy': return 'Accuracy'
      case 'alpha': return 'Alpha'
      case 'calibration': return 'Calibration'
      case 'consistency': return 'Consistency'
      case 'pnl': return 'PnL'
      default: return 'Score'
    }
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          Rankings{' '}
          <span className="text-gray-500 text-sm font-normal ml-1">
            ({entries.length} predictors)
          </span>
        </h2>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Predictor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {getSortLabel()}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Win Rate
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Predictions
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  PnL
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-sm">No predictors found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isMe = connectedAddress?.toLowerCase() === entry.address.toLowerCase()
                  const score = getScoreBySort(entry)

                  return (
                    <tr
                      key={entry.address}
                      className={`border-b border-gray-800 transition-all duration-500 ${
                        entry.flash
                          ? 'animate-pulse bg-green-950/30'
                          : isMe
                          ? 'bg-purple-950/20'
                          : 'hover:bg-gray-900/50'
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-bold ${
                            entry.rank === 1
                              ? 'text-yellow-400'
                              : entry.rank === 2
                              ? 'text-gray-300'
                              : entry.rank === 3
                              ? 'text-orange-600'
                              : 'text-gray-500'
                          }`}
                        >
                          {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                        </span>
                      </td>

                      {/* Predictor */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/profile/${entry.address}`}
                          className="flex items-center gap-3 group"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{
                              background: `hsl(${parseInt(entry.address.slice(2, 8), 16) % 360}, 65%, 40%)`,
                            }}
                          >
                            {entry.address.slice(2, 4).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors font-mono">
                              {formatAddress(entry.address)}
                            </div>
                            {isMe && (
                              <div className="text-xs text-purple-400">You</div>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* Tier */}
                      <td className="px-4 py-3">
                        <TierBadge tier={entry.tier} size="sm" />
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3 text-right">
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{ color: tierColor(entry.tier) }}
                        >
                          {sort === 'pnl' ? formatPnL(score) : formatScore(score)}
                        </span>
                      </td>

                      {/* Win Rate */}
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="text-sm text-green-400 font-medium">
                          {formatWinRate(entry.winRate)}
                        </span>
                      </td>

                      {/* Predictions */}
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="text-sm text-gray-400">{entry.totalPredictions}</span>
                      </td>

                      {/* PnL */}
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span
                          className={`text-sm font-medium ${
                            entry.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {formatPnL(entry.pnl)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* My rank sticky row */}
      {myEntry && !loading && (
        <div className="mt-4 rounded-xl border border-purple-500/30 bg-purple-950/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-purple-400">Your Rank</span>
              <span className="text-xl font-bold text-white">#{myEntry.rank}</span>
              <TierBadge tier={myEntry.tier} size="sm" />
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <div className="text-gray-400">Score</div>
                <div className="font-bold text-white">{formatScore(myEntry.compositeScore)}</div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-gray-400">Win Rate</div>
                <div className="font-bold text-green-400">{formatWinRate(myEntry.winRate)}</div>
              </div>
              <Link
                href={`/profile/${myEntry.address}`}
                className="rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                View Profile
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
