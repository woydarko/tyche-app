'use client'

import { useState } from 'react'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import PodiumTop3 from '@/components/leaderboard/PodiumTop3'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import LeaderboardFilters from '@/components/leaderboard/LeaderboardFilters'

export default function LeaderboardPage() {
  const [sort, setSort] = useState('composite')
  const [season, setSeason] = useState<number | undefined>(undefined)

  const { entries, loading, lastUpdated } = useLeaderboard(sort, season)

  const top3 = entries.slice(0, 3)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
          <div className="flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-950/30 px-3 py-1 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>
        </div>
        <p className="text-gray-400">
          Top predictors ranked by on-chain reputation score — updated in real-time.
        </p>
      </div>

      {/* Podium */}
      {!loading && top3.length >= 3 && (
        <PodiumTop3 entries={top3} />
      )}

      {/* Filters */}
      <LeaderboardFilters
        sort={sort}
        onSortChange={setSort}
        season={season}
        onSeasonChange={setSeason}
      />

      {/* Table with WebSocket live updates (TYC-47) */}
      <LeaderboardTable
        entries={entries}
        loading={loading}
        lastUpdated={lastUpdated}
        sort={sort}
      />
    </div>
  )
}
