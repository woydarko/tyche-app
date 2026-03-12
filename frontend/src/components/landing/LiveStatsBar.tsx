'use client'

import { useState, useEffect, useRef } from 'react'
import { useLiveStats } from '@/hooks/useLiveStats'

interface AnimatedCounterProps {
  target: number
  duration?: number
  className?: string
}

function AnimatedCounter({ target, duration = 1500, className = '' }: AnimatedCounterProps) {
  const [current, setCurrent] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === prevTarget.current) return
    const start = prevTarget.current
    const diff = target - start
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(start + diff * eased))
      if (progress < 1) requestAnimationFrame(step)
      else prevTarget.current = target
    }

    requestAnimationFrame(step)
  }, [target, duration])

  return (
    <span className={className}>
      {current.toLocaleString()}
    </span>
  )
}

export default function LiveStatsBar() {
  const { stats, loading } = useLiveStats()

  const statItems = [
    {
      label: 'Total Predictors',
      value: stats.totalPredictors,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Markets Resolved Today',
      value: stats.marketsResolvedToday,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Predictions Scored',
      value: stats.predictionsScored,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ]

  return (
    <section className="border-y border-gray-800 bg-gray-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-gray-400 font-medium">Live on-chain stats</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-12">
          {statItems.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2 text-purple-400">
                {item.icon}
              </div>
              {loading ? (
                <div className="h-9 w-24 rounded-lg bg-gray-800 animate-pulse" />
              ) : (
                <AnimatedCounter
                  target={item.value}
                  className="text-3xl font-bold text-white tabular-nums"
                />
              )}
              <span className="text-sm text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
