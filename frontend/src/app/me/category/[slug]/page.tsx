'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useProfile } from '@/hooks/useProfile'
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api'
import { formatAddress, formatWinRate } from '@/lib/utils'
import { TIER_COLORS } from '@/lib/constants'
import TierBadge from '@/components/ui/TierBadge'

const CATEGORY_EMOJIS: Record<string, string> = {
  crypto: '₿',
  sports: '⚽',
  politics: '🏛️',
  tech: '💻',
  science: '🔬',
}

// SVG circle progress ring
function ProgressRing({ value, max = 10000, size = 140, strokeWidth = 10, color = '#c084fc' }: {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(value / max, 1)
  const offset = circumference - pct * circumference
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white">{value.toLocaleString()}</span>
        <span className="text-xs text-gray-500">/ {max.toLocaleString()}</span>
      </div>
    </div>
  )
}

// Build monthly bar data from predictions
function buildMonthlyData(predictions: Array<{ createdAt: number; category?: string }>, slug: string) {
  const now = Date.now()
  const months: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    months[key] = 0
  }
  predictions.forEach((p) => {
    if ((p.category ?? '').toLowerCase() === slug.toLowerCase()) {
      const d = new Date(p.createdAt * 1000)
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
      if (key in months) months[key]++
    }
  })
  return Object.entries(months).map(([month, count]) => ({ month, count }))
}

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const slug = (params.slug as string).toLowerCase()
  const { address, isConnected } = useAccount()
  const { profile, predictions, loading } = useProfile(address)
  const [comparables, setComparables] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    if (!isConnected) router.replace('/')
  }, [isConnected, router])

  useEffect(() => {
    getLeaderboard(20).then((data) => {
      setComparables(data.slice(0, 3))
    })
  }, [])

  const categoryData = useMemo(() => {
    return profile?.categoryPerformance?.find(
      (c) => c.category.toLowerCase() === slug
    ) ?? null
  }, [profile, slug])

  const monthlyData = useMemo(() => {
    return buildMonthlyData(predictions, slug)
  }, [predictions, slug])

  const displayName = slug.charAt(0).toUpperCase() + slug.slice(1)
  const emoji = CATEGORY_EMOJIS[slug] ?? '📊'

  if (!isConnected) return null

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Back */}
        <Link href="/me" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          ← My Profile
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-900/40 border border-purple-800/40 text-3xl">
            {emoji}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{displayName} Mastery</h1>
            <p className="text-gray-400">Category performance deep-dive</p>
          </div>
        </div>

        {/* Score ring + stats */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Ring */}
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={categoryData?.score ?? 0} color="#c084fc" />
              <p className="text-xs text-gray-500 text-center">Category Score</p>
            </div>

            {/* Stats grid */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-gray-950 border border-gray-800 p-4">
                <p className="text-2xl font-bold text-white">{categoryData?.predictions ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total Predictions</p>
              </div>
              <div className="rounded-xl bg-gray-950 border border-gray-800 p-4">
                <p className="text-2xl font-bold text-green-400">
                  {categoryData ? formatWinRate(categoryData.winRate) : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Win Rate</p>
              </div>
              <div className="rounded-xl bg-gray-950 border border-gray-800 p-4">
                <p className={`text-2xl font-bold ${(categoryData?.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {categoryData?.pnl != null ? (categoryData.pnl >= 0 ? '+' : '') + categoryData.pnl.toFixed(2) : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Category PnL</p>
              </div>
              <div className="rounded-xl bg-gray-950 border border-gray-800 p-4">
                <p className="text-2xl font-bold text-purple-400">
                  {profile ? (profile.accuracyScore / 100).toFixed(0) + 'th' : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Percentile</p>
              </div>
            </div>
          </div>
        </div>

        {!categoryData && (
          <div className="rounded-xl border border-yellow-900/40 bg-yellow-900/10 p-4 text-sm text-yellow-400">
            No {displayName} prediction data found yet. Make predictions in this category to build your mastery score.
          </div>
        )}

        {/* Monthly chart */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Predictions by Month</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="count" fill="#c084fc" radius={[4, 4, 0, 0]} name="Predictions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Comparable predictors */}
        {comparables.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Comparable Predictors</h2>
            <div className="grid gap-3">
              {comparables.map((entry) => {
                const color = TIER_COLORS[Math.min(entry.tier, 4)]
                return (
                  <Link
                    key={entry.address}
                    href={`/profile/${entry.address}`}
                    className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4 hover:border-gray-700 hover:bg-gray-800/60 transition-all"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white bg-purple-600`}>
                      {entry.address.slice(2, 4).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-mono text-sm text-white">{formatAddress(entry.address)}</p>
                      <TierBadge tier={entry.tier} size="sm" />
                    </div>
                    <div className="text-right">
                      <p className="font-bold font-mono text-sm" style={{ color }}>{entry.compositeScore.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{formatWinRate(entry.winRate)} WR</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
