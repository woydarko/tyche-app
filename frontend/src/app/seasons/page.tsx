'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSeasons, type SeasonDetail } from '@/lib/api'
import { formatAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'

function StatusBadge({ status }: { status: SeasonDetail['status'] }) {
  const map = {
    active: 'bg-green-900/40 text-green-400 border-green-800/50',
    ended: 'bg-gray-800 text-gray-400 border-gray-700',
    upcoming: 'bg-blue-900/40 text-blue-400 border-blue-800/50',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status]}`}>
      {status === 'active' && <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse" />}
      {status}
    </span>
  )
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<SeasonDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSeasons().then((data) => {
      setSeasons(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Season Archive</h1>
          <p className="mt-1 text-gray-400">All Tyche prediction seasons on Somnia</p>
        </div>

        {seasons.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 py-16 text-center text-gray-500">
            No seasons found.
          </div>
        ) : (
          <div className="grid gap-4">
            {seasons.map((season) => {
              const isActive = season.status === 'active'
              return (
                <Link
                  key={season.id}
                  href={`/seasons/${season.id}`}
                  className={cn(
                    'block rounded-xl border bg-gray-900 p-6 transition-all hover:bg-gray-800/60',
                    isActive
                      ? 'border-purple-600 ring-1 ring-purple-600/30'
                      : 'border-gray-800 hover:border-gray-700'
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-white">{season.name}</h2>
                        <StatusBadge status={season.status} />
                        {isActive && (
                          <span className="text-xs text-purple-400 font-semibold">CURRENT</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        {formatDate(season.startTime)} — {formatDate(season.endTime)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-6 text-center">
                      {season.participantCount != null && (
                        <div>
                          <p className="text-lg font-bold text-white">{season.participantCount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">Participants</p>
                        </div>
                      )}
                      {season.topScorer && (
                        <div>
                          <p className="text-lg font-bold text-purple-400">{formatAddress(season.topScorer)}</p>
                          <p className="text-xs text-gray-500">Top Scorer</p>
                        </div>
                      )}
                      {season.topScore != null && (
                        <div>
                          <p className="text-lg font-bold text-yellow-400">{season.topScore.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">Top Score</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Blocks {season.startBlock.toLocaleString()} – {season.endBlock.toLocaleString()}
                    </p>
                    <span className="text-xs text-purple-400">View Season →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
