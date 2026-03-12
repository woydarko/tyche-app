'use client'

interface LeaderboardFiltersProps {
  sort: string
  onSortChange: (sort: string) => void
  season: number | undefined
  onSeasonChange: (season: number | undefined) => void
}

const SORT_OPTIONS = [
  { value: 'composite', label: 'Composite Score' },
  { value: 'accuracy', label: 'Accuracy' },
  { value: 'alpha', label: 'Alpha' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'pnl', label: 'PnL' },
]

export default function LeaderboardFilters({
  sort,
  onSortChange,
  season,
  onSeasonChange,
}: LeaderboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Sort by */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400 whitespace-nowrap">Sort by:</span>
        <div className="flex flex-wrap gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sort === opt.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Season filter */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-sm text-gray-400">Season:</span>
        <select
          value={season ?? ''}
          onChange={(e) => onSeasonChange(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-1.5 focus:outline-none focus:border-purple-500"
        >
          <option value="">All Time</option>
          {[1, 2, 3, 4, 5].map((s) => (
            <option key={s} value={s}>
              Season {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
