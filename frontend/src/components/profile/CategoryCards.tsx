import { type ProfileData } from '@/lib/api'
import { formatWinRate, formatPnL, formatScore } from '@/lib/utils'

interface CategoryCardsProps {
  profile: ProfileData
}

export default function CategoryCards({ profile }: CategoryCardsProps) {
  const categories = profile.categoryPerformance

  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-base font-semibold text-white mb-4">Category Performance</h3>
        <div className="text-center py-8 text-gray-500 text-sm">
          No category data available yet
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-base font-semibold text-white mb-4">Category Performance</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const isBest = cat.category === profile.bestCategory
          return (
            <div
              key={cat.category}
              className={`rounded-lg p-4 border transition-colors ${
                isBest
                  ? 'border-purple-500/30 bg-purple-950/20'
                  : 'border-gray-800 bg-gray-800/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-semibold text-white">{cat.category}</span>
                {isBest && (
                  <span className="text-xs text-purple-400 bg-purple-950 border border-purple-500/30 rounded-full px-2 py-0.5">
                    Best
                  </span>
                )}
              </div>

              {/* Score bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Score</span>
                  <span className="font-medium text-white">{formatScore(cat.score)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all duration-700"
                    style={{ width: `${Math.min((cat.score / 10000) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-gray-500">Predictions</div>
                  <div className="font-medium text-white">{cat.predictions}</div>
                </div>
                <div>
                  <div className="text-gray-500">Win Rate</div>
                  <div className="font-medium text-green-400">{formatWinRate(cat.winRate)}</div>
                </div>
                <div>
                  <div className="text-gray-500">PnL</div>
                  <div className={`font-medium ${cat.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPnL(cat.pnl)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
