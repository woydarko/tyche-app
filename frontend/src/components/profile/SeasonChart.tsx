'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { type ProfileData } from '@/lib/api'
import { formatScore } from '@/lib/utils'

interface SeasonChartProps {
  profile: ProfileData
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm shadow-xl">
      <div className="text-gray-400 mb-1">Season {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="text-purple-400 font-semibold">{formatScore(p.value)}</span>
          <span className="text-gray-500 text-xs">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

export default function SeasonChart({ profile }: SeasonChartProps) {
  // Generate mock season data based on current profile for display
  // In production, this would come from the API
  const seasonData = Array.from({ length: Math.max(profile.seasonsActive, 1) }, (_, i) => ({
    season: i + 1,
    score: Math.floor(
      profile.compositeScore * (0.4 + (0.6 * (i + 1)) / Math.max(profile.seasonsActive, 1))
    ),
    winRate: Math.floor(profile.winRate * 80 + (i * 5)),
  }))

  if (seasonData.length < 2) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-base font-semibold text-white mb-4">Season Performance</h3>
        <div className="text-center py-8 text-gray-500 text-sm">
          {seasonData.length === 0
            ? 'No season data yet'
            : 'Keep predicting to see your trend over seasons'}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-white">Season Performance</h3>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-purple-500" />
            <span>Composite Score</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={seasonData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="season"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickFormatter={(v) => `S${v}`}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={profile.compositeScore}
            stroke="rgba(168,85,247,0.3)"
            strokeDasharray="4 4"
            label={{ value: 'Current', fill: '#9ca3af', fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="score"
            name="Score"
            stroke="#a855f7"
            strokeWidth={2.5}
            dot={{ fill: '#a855f7', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: '#c084fc' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
