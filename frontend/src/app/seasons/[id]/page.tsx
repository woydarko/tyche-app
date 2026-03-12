'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { getSeasonDetail, getSeasonLeaderboard, type SeasonDetail, type LeaderboardEntry } from '@/lib/api'
import TierBadge from '@/components/ui/TierBadge'
import { formatAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatDuration(startBlock: number, endBlock: number): string {
  const blocks = endBlock - startBlock
  return `${blocks.toLocaleString()} blocks`
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-400 font-bold">🥇 1</span>
  if (rank === 2) return <span className="text-gray-300 font-bold">🥈 2</span>
  if (rank === 3) return <span className="text-orange-400 font-bold">🥉 3</span>
  return <span className="text-gray-400 font-mono">#{rank}</span>
}

export default function SeasonDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const { address: myAddress, isConnected } = useAccount()

  const [season, setSeason] = useState<SeasonDetail | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [seasonData, lbData] = await Promise.all([
        getSeasonDetail(id),
        getSeasonLeaderboard(id),
      ])
      setSeason(seasonData)
      setLeaderboard(lbData)
      setLoading(false)
    }
    if (!isNaN(id)) load()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!season) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-white">Season Not Found</h1>
          <Link href="/seasons" className="text-purple-400 hover:text-purple-300 transition-colors">
            ← Back to Seasons
          </Link>
        </div>
      </div>
    )
  }

  const myEntry = leaderboard.find(
    (e) => e.address.toLowerCase() === (myAddress ?? '').toLowerCase()
  )

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Back */}
        <Link href="/seasons" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          ← All Seasons
        </Link>

        {/* Season header */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white">{season.name}</h1>
                <span className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
                  season.status === 'active'
                    ? 'bg-green-900/40 text-green-400 border-green-800/50'
                    : season.status === 'upcoming'
                    ? 'bg-blue-900/40 text-blue-400 border-blue-800/50'
                    : 'bg-gray-800 text-gray-400 border-gray-700'
                )}>
                  {season.status}
                </span>
              </div>
              <p className="text-gray-400">
                {formatDate(season.startTime)} — {formatDate(season.endTime)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl bg-gray-950 border border-gray-800 p-4 text-center">
              <p className="text-lg font-bold text-white">{formatDuration(season.startBlock, season.endBlock)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Duration</p>
            </div>
            <div className="rounded-xl bg-gray-950 border border-gray-800 p-4 text-center">
              <p className="text-lg font-bold text-white">{season.participantCount?.toLocaleString() ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Participants</p>
            </div>
            <div className="rounded-xl bg-gray-950 border border-gray-800 p-4 text-center">
              <p className="text-lg font-bold text-purple-400 font-mono">{season.topScorer ? formatAddress(season.topScorer) : '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Top Scorer</p>
            </div>
            <div className="rounded-xl bg-gray-950 border border-gray-800 p-4 text-center">
              <p className="text-lg font-bold text-yellow-400">{season.topScore?.toLocaleString() ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">High Score</p>
            </div>
          </div>
        </div>

        {/* My rank card */}
        {isConnected && myAddress && (
          <div className={cn(
            'rounded-xl border p-5 flex items-center justify-between',
            myEntry
              ? 'border-purple-700 bg-purple-900/20'
              : 'border-gray-800 bg-gray-900'
          )}>
            <div>
              <p className="text-sm text-gray-400">Your Rank This Season</p>
              {myEntry ? (
                <div className="mt-1 flex items-center gap-3">
                  <RankBadge rank={myEntry.rank} />
                  <span className="text-xl font-bold text-white">{myEntry.compositeScore.toLocaleString()}</span>
                  <TierBadge tier={myEntry.tier} size="sm" />
                </div>
              ) : (
                <p className="text-gray-500 mt-1">You did not participate in this season.</p>
              )}
            </div>
            {myEntry && (
              <Link
                href={`/profile/${myAddress}`}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                View Profile →
              </Link>
            )}
          </div>
        )}

        {/* Leaderboard table */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Season Leaderboard</h2>

          {leaderboard.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 py-12 text-center text-gray-500">
              No leaderboard data yet for this season.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Rank</th>
                    <th className="px-4 py-3 text-left">Predictor</th>
                    <th className="px-4 py-3 text-left">Tier</th>
                    <th className="px-4 py-3 text-right">Score</th>
                    <th className="px-4 py-3 text-right">Win Rate</th>
                    <th className="px-4 py-3 text-right">Predictions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {leaderboard.map((entry) => {
                    const isMe = myAddress && entry.address.toLowerCase() === myAddress.toLowerCase()
                    return (
                      <tr
                        key={entry.address}
                        className={cn(
                          'hover:bg-gray-800/30 transition-colors',
                          isMe ? 'bg-purple-900/10' : ''
                        )}
                      >
                        <td className="px-4 py-3">
                          <RankBadge rank={entry.rank} />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/profile/${entry.address}`}
                            className="font-mono text-gray-300 hover:text-purple-400 transition-colors"
                          >
                            {formatAddress(entry.address)}
                            {isMe && <span className="ml-2 text-xs text-purple-400">(you)</span>}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <TierBadge tier={entry.tier} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-white">
                          {entry.compositeScore.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {(entry.winRate * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {entry.totalPredictions}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
