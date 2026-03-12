'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useProfile } from '@/hooks/useProfile'
import { type Prediction } from '@/lib/api'
import { formatAddress, formatPnL } from '@/lib/utils'

interface DimensionCard {
  key: keyof { accuracyScore: number; alphaScore: number; calibrationScore: number; consistencyScore: number; compositeScore: number }
  label: string
  color: string
  description: string
  tip?: string
}

const DIMENSIONS: DimensionCard[] = [
  {
    key: 'accuracyScore' as const,
    label: 'Accuracy',
    color: '#a78bfa',
    description: 'How often your predictions are correct. Measures the raw hit rate across all resolved markets.',
    tip: 'Make more confident predictions in markets where you have an edge. Avoid low-conviction bets.',
  },
  {
    key: 'alphaScore' as const,
    label: 'Alpha',
    color: '#34d399',
    description: 'How much outperformance you generate vs. the crowd. High alpha means you consistently beat market consensus.',
    tip: 'Focus on under-explored markets where you have unique information. Contrarian wins score highest.',
  },
  {
    key: 'calibrationScore' as const,
    label: 'Calibration',
    color: '#60a5fa',
    description: 'How well your stated confidence matches your actual win rate. Perfect calibration = 70% confident means 70% win rate.',
    tip: 'Be honest about your uncertainty. Overconfident bets hurt calibration even when you win.',
  },
  {
    key: 'consistencyScore' as const,
    label: 'Consistency',
    color: '#f472b6',
    description: 'How stable your performance is over time. Consistent predictors maintain their edge across seasons.',
    tip: 'Predict regularly across seasons. Large gaps or erratic performance reduce your consistency score.',
  },
  {
    key: 'compositeScore' as const,
    label: 'Composite',
    color: '#e879f9',
    description: 'Your overall Tyche Score — a weighted blend of all four dimensions, normalized to 10,000.',
  },
]

function TrendArrow({ value, threshold = 4000 }: { value: number; threshold?: number }) {
  if (value >= threshold * 1.1) return <span className="text-green-400 text-lg">↑</span>
  if (value < threshold * 0.7) return <span className="text-red-400 text-lg">↓</span>
  return <span className="text-gray-500 text-lg">→</span>
}

function ScoreCard({
  dimension,
  value,
  isOpen,
  onToggle,
}: {
  dimension: DimensionCard
  value: number
  isOpen: boolean
  onToggle: () => void
}) {
  const pct = Math.min((value / 10000) * 100, 100)
  const needsTip = value < 4000 && dimension.tip

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dimension.color }} />
          <span className="font-semibold text-white">{dimension.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendArrow value={value} />
          <span className="text-xl font-bold font-mono" style={{ color: dimension.color }}>
            {value.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: dimension.color }}
        />
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{dimension.description}</p>

      {needsTip && (
        <div className="rounded-lg bg-yellow-900/20 border border-yellow-800/40 p-3">
          <p className="text-xs text-yellow-400">
            <span className="font-semibold">Tip: </span>{dimension.tip}
          </p>
        </div>
      )}
    </div>
  )
}

// Generate mock seasonal timeline data from composite score
function buildTimeline(compositeScore: number) {
  const base = Math.max(compositeScore - 3000, 500)
  return Array.from({ length: 10 }, (_, i) => {
    const progress = i / 9
    const noise = (Math.random() - 0.5) * 400
    return {
      season: `S${i + 1}`,
      score: Math.round(base + (compositeScore - base) * progress + noise),
    }
  })
}

export default function ScorePage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { profile, predictions, loading } = useProfile(address)
  const [formulaOpen, setFormulaOpen] = useState(false)
  const [timeline, setTimeline] = useState<{ season: string; score: number }[]>([])

  useEffect(() => {
    if (!isConnected) {
      router.replace('/')
    }
  }, [isConnected, router])

  useEffect(() => {
    if (profile) {
      setTimeline(buildTimeline(profile.compositeScore))
    }
  }, [profile])

  if (!isConnected) return null

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-400">
        No profile found for {formatAddress(address ?? '')}
      </div>
    )
  }

  const positiveP = predictions.filter((p: Prediction) => (p.pnl ?? 0) > 0).sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0)).slice(0, 3)
  const negativeP = predictions.filter((p: Prediction) => (p.pnl ?? 0) < 0).sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0)).slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Score Breakdown</h1>
          <p className="mt-1 text-gray-400">Deep dive into your Tyche reputation dimensions</p>
        </div>

        {/* Timeline chart */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Score Timeline</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="season" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#c084fc"
                strokeWidth={2.5}
                dot={{ fill: '#c084fc', r: 4 }}
                activeDot={{ r: 6 }}
                name="Composite Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Dimension cards */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Score Dimensions</h2>
          <div className="grid gap-4">
            {DIMENSIONS.map((d) => (
              <ScoreCard
                key={d.key}
                dimension={d}
                value={profile[d.key] as number}
                isOpen={formulaOpen}
                onToggle={() => setFormulaOpen(!formulaOpen)}
              />
            ))}
          </div>
        </div>

        {/* Formula explainer */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <button
            onClick={() => setFormulaOpen(!formulaOpen)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/50 transition-colors"
          >
            <span className="font-semibold text-white">How is Tyche Score calculated?</span>
            <span className="text-gray-400 text-lg">{formulaOpen ? '−' : '+'}</span>
          </button>
          {formulaOpen && (
            <div className="px-5 pb-6 space-y-4 border-t border-gray-800">
              <div className="mt-4 space-y-3 text-sm text-gray-400 leading-relaxed">
                <p>
                  <span className="text-purple-400 font-semibold">Accuracy (25%)</span> — Your raw win rate weighted by market difficulty. Correct predictions in competitive markets score more than easy consensus picks.
                </p>
                <p>
                  <span className="text-green-400 font-semibold">Alpha (30%)</span> — Your edge over the crowd. Calculated by comparing your outcomes to the market average. Contrarian winners score highest here.
                </p>
                <p>
                  <span className="text-blue-400 font-semibold">Calibration (20%)</span> — How honest your confidence is. Measured with Brier scoring — stated confidence that matches your win rate gives maximum points.
                </p>
                <p>
                  <span className="text-pink-400 font-semibold">Consistency (25%)</span> — Season-over-season stability. Predictors who maintain their edge across multiple seasons receive a reliability bonus.
                </p>
                <div className="rounded-lg bg-gray-800 p-3 font-mono text-xs text-gray-300">
                  Composite = (Accuracy × 0.25) + (Alpha × 0.30) + (Calibration × 0.20) + (Consistency × 0.25)
                </div>
                <p className="text-xs text-gray-500">
                  All dimensions are normalized to a 0–10,000 scale. Scores are updated on-chain after each market resolution.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* What helped / what hurt */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-green-900/40 bg-green-900/10 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-green-400 uppercase tracking-widest">What Improved Your Score</h3>
            {positiveP.length === 0 ? (
              <p className="text-sm text-gray-500">No profitable predictions yet.</p>
            ) : (
              <div className="space-y-2">
                {positiveP.map((p: Prediction) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 truncate mr-2 max-w-[180px]">{p.marketTitle}</span>
                    <span className="text-green-400 font-mono font-semibold">{formatPnL(p.pnl ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-red-400 uppercase tracking-widest">What Hurt Your Score</h3>
            {negativeP.length === 0 ? (
              <p className="text-sm text-gray-500">No losing predictions — keep it up!</p>
            ) : (
              <div className="space-y-2">
                {negativeP.map((p: Prediction) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 truncate mr-2 max-w-[180px]">{p.marketTitle}</span>
                    <span className="text-red-400 font-mono font-semibold">{formatPnL(p.pnl ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
