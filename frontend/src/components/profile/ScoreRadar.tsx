'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { type ProfileData } from '@/lib/api'
import { formatScore } from '@/lib/utils'

interface ScoreRadarProps {
  profile: ProfileData
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: { subject: string; value: number; fullScore: number } }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm shadow-xl">
      <div className="font-semibold text-white">{data.subject}</div>
      <div className="text-purple-400">{formatScore(data.fullScore)}</div>
    </div>
  )
}

export default function ScoreRadar({ profile }: ScoreRadarProps) {
  const MAX_SCORE = 10000

  const data = [
    {
      subject: 'Accuracy',
      value: (profile.accuracyScore / MAX_SCORE) * 100,
      fullScore: profile.accuracyScore,
    },
    {
      subject: 'Alpha',
      value: (profile.alphaScore / MAX_SCORE) * 100,
      fullScore: profile.alphaScore,
    },
    {
      subject: 'Calibration',
      value: (profile.calibrationScore / MAX_SCORE) * 100,
      fullScore: profile.calibrationScore,
    },
    {
      subject: 'Consistency',
      value: (profile.consistencyScore / MAX_SCORE) * 100,
      fullScore: profile.consistencyScore,
    },
    {
      subject: 'Composite',
      value: (profile.compositeScore / MAX_SCORE) * 100,
      fullScore: profile.compositeScore,
    },
  ]

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-base font-semibold text-white mb-4">Score Breakdown</h3>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickCount={4}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#a855f7"
            fill="#a855f7"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Score legend */}
      <div className="grid grid-cols-5 gap-2 mt-2">
        {data.map((dim) => (
          <div key={dim.subject} className="text-center">
            <div className="text-xs text-gray-500">{dim.subject}</div>
            <div className="text-sm font-bold text-purple-400">{formatScore(dim.fullScore)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
