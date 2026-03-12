'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api'
import TierBadge from '@/components/ui/TierBadge'
import { TIER_NAMES, TIER_COLORS } from '@/lib/constants'
import { formatAddress, formatWinRate } from '@/lib/utils'
import { cn } from '@/lib/utils'

type ViewMode = 'grid' | 'list'
type TierFilter = 'All' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Oracle'

const TIER_FILTER_OPTIONS: TierFilter[] = ['All', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Oracle']

function addressColor(address: string): string {
  const hash = address.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const colors = [
    'bg-purple-600', 'bg-blue-600', 'bg-green-600', 'bg-pink-600',
    'bg-yellow-600', 'bg-indigo-600', 'bg-teal-600', 'bg-orange-600',
  ]
  return colors[hash % colors.length]
}

function UserCard({ entry, view }: { entry: LeaderboardEntry; view: ViewMode }) {
  const tierColor = TIER_COLORS[Math.min(entry.tier, 4)]

  if (view === 'list') {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4 hover:border-gray-700 transition-all">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${addressColor(entry.address)}`}>
          {entry.address.slice(2, 4).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${entry.address}`} className="font-mono text-sm text-white hover:text-purple-400 transition-colors">
            {formatAddress(entry.address)}
          </Link>
          <div className="flex items-center gap-3 mt-0.5">
            <TierBadge tier={entry.tier} size="sm" />
            <span className="text-xs text-gray-500">Win rate: {formatWinRate(entry.winRate)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold font-mono" style={{ color: tierColor }}>{entry.compositeScore.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Score</p>
        </div>
        <Link
          href={`/profile/${entry.address}`}
          className="rounded-lg border border-purple-700 bg-purple-900/30 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-900/60 transition-colors"
        >
          View
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col gap-4 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white ${addressColor(entry.address)}`}>
          {entry.address.slice(2, 4).toUpperCase()}
        </div>
        <TierBadge tier={entry.tier} size="sm" />
      </div>

      <div>
        <Link href={`/profile/${entry.address}`} className="font-mono text-sm text-white hover:text-purple-400 transition-colors block">
          {formatAddress(entry.address)}
        </Link>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Score</span>
            <p className="font-bold font-mono mt-0.5" style={{ color: tierColor }}>{entry.compositeScore.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Win Rate</span>
            <p className="font-bold mt-0.5 text-green-400">{formatWinRate(entry.winRate)}</p>
          </div>
        </div>
      </div>

      <Link
        href={`/profile/${entry.address}`}
        className="w-full text-center rounded-lg border border-purple-700 bg-purple-900/30 px-4 py-2 text-xs font-medium text-purple-300 hover:bg-purple-900/60 transition-colors"
      >
        View Profile
      </Link>
    </div>
  )
}

export default function ExplorePage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<TierFilter>('All')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => {
    getLeaderboard(100).then((data) => {
      setEntries(data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    let data = entries

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      data = data.filter((e) => e.address.toLowerCase().includes(q))
    }

    if (tierFilter !== 'All') {
      const tierIdx = TIER_NAMES.indexOf(tierFilter as typeof TIER_NAMES[number])
      if (tierIdx !== -1) {
        data = data.filter((e) => e.tier === tierIdx)
      }
    }

    return data
  }, [entries, search, tierFilter])

  const risingStar = entries.slice(0, 5)
  const specialists = entries.length > 0 ? [entries[0]] : []

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-6xl space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Explore Predictors</h1>
          <p className="mt-1 text-gray-400">Discover top forecasters on Somnia</p>
        </div>

        {/* Rising Stars */}
        {!loading && risingStar.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌟</span>
              <h2 className="text-lg font-bold text-white">Rising Stars</h2>
              <span className="text-xs text-gray-500">Top 5 by score</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {risingStar.map((entry) => (
                <Link
                  key={entry.address}
                  href={`/profile/${entry.address}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-700 hover:bg-gray-800/60 transition-all"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${addressColor(entry.address)}`}>
                    {entry.address.slice(2, 4).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-mono text-white">{formatAddress(entry.address)}</p>
                    <p className="text-xs text-purple-400 font-semibold">{entry.compositeScore.toLocaleString()} pts</p>
                  </div>
                  <TierBadge tier={entry.tier} size="sm" showIcon={false} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Specialists */}
        {!loading && specialists.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h2 className="text-lg font-bold text-white">Specialists</h2>
              <span className="text-xs text-gray-500">High-precision predictors</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {specialists.map((entry) => (
                <Link
                  key={entry.address}
                  href={`/profile/${entry.address}`}
                  className="flex items-center gap-3 rounded-xl border border-yellow-800/40 bg-yellow-900/10 px-4 py-3 hover:bg-yellow-900/20 transition-all"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${addressColor(entry.address)}`}>
                    {entry.address.slice(2, 4).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-mono text-white">{formatAddress(entry.address)}</p>
                    <p className="text-xs text-yellow-400 font-semibold">{formatWinRate(entry.winRate)} win rate</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by address..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex gap-1 rounded-xl bg-gray-900 p-1 border border-gray-800 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('px-3 py-1.5 rounded-lg transition-colors', viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white')}
              title="Grid view"
            >
              ⊞
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('px-3 py-1.5 rounded-lg transition-colors', viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white')}
              title="List view"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Tier filter pills */}
        <div className="flex flex-wrap gap-2">
          {TIER_FILTER_OPTIONS.map((t) => {
            const isActive = tierFilter === t
            const tierIdx = TIER_NAMES.indexOf(t as typeof TIER_NAMES[number])
            const color = tierIdx >= 0 ? TIER_COLORS[tierIdx] : undefined
            return (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium border transition-all',
                  isActive
                    ? 'text-white border-transparent'
                    : 'text-gray-400 border-gray-700 hover:text-white hover:border-gray-600'
                )}
                style={isActive && color ? { backgroundColor: color + '30', borderColor: color + '60', color } : {}}
              >
                {t}
              </button>
            )
          })}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 py-16 text-center text-gray-500">
            No predictors found matching your criteria.
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">{filtered.length} predictor{filtered.length !== 1 ? 's' : ''} found</p>
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'flex flex-col gap-3'
            }>
              {filtered.map((entry) => (
                <UserCard key={entry.address} entry={entry} view={viewMode} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
