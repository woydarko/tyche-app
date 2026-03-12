import Link from 'next/link'
import { type LeaderboardEntry } from '@/lib/api'
import { formatAddress, formatScore, formatWinRate, tierColor } from '@/lib/utils'
import TierBadge from '@/components/ui/TierBadge'

interface PodiumTop3Props {
  entries: LeaderboardEntry[]
}

function PodiumCard({
  entry,
  position,
}: {
  entry: LeaderboardEntry
  position: 1 | 2 | 3
}) {
  const sizeClasses = {
    1: 'scale-110 z-10',
    2: 'z-0',
    3: 'z-0',
  }

  const heightClasses = {
    1: 'pt-8',
    2: 'pt-16',
    3: 'pt-20',
  }

  const ringColors = {
    1: 'ring-2 ring-yellow-400/60',
    2: 'ring-2 ring-gray-400/40',
    3: 'ring-2 ring-orange-700/40',
  }

  const crownColors = {
    1: 'text-yellow-400',
    2: 'text-gray-400',
    3: 'text-orange-700',
  }

  const rankLabels = { 1: '#1', 2: '#2', 3: '#3' }
  const borderGlow = position === 1 ? 'shadow-gold-glow border-yellow-400/30' : 'border-gray-800'

  return (
    <Link
      href={`/profile/${entry.address}`}
      className={`relative flex flex-col items-center rounded-xl border bg-gray-900 p-6 transition-all hover:bg-gray-800 ${heightClasses[position]} ${sizeClasses[position]} ${borderGlow}`}
      style={{ minWidth: '180px' }}
    >
      {/* Rank label */}
      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-sm font-bold ${crownColors[position]} bg-gray-950 border border-current`}>
        {rankLabels[position]}
      </div>

      {/* Avatar */}
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white mb-3 ${ringColors[position]}`}
        style={{
          background: `hsl(${parseInt(entry.address.slice(2, 8), 16) % 360}, 65%, 40%)`,
        }}
      >
        {entry.address.slice(2, 4).toUpperCase()}
      </div>

      {/* Address */}
      <div className="text-sm font-semibold text-white font-mono mb-2">
        {formatAddress(entry.address)}
      </div>

      {/* Tier */}
      <TierBadge tier={entry.tier} size="sm" />

      {/* Score */}
      <div className="mt-3 text-2xl font-black text-white" style={{ color: tierColor(entry.tier) }}>
        {formatScore(entry.compositeScore)}
      </div>
      <div className="text-xs text-gray-500">Composite</div>

      {/* Win rate */}
      <div className="mt-3 flex items-center gap-1 text-xs">
        <span className="text-gray-400">Win Rate</span>
        <span className="text-green-400 font-semibold">{formatWinRate(entry.winRate)}</span>
      </div>
    </Link>
  )
}

export default function PodiumTop3({ entries }: PodiumTop3Props) {
  if (entries.length === 0) return null

  const [first, second, third] = entries

  return (
    <div className="mb-10">
      <div className="flex items-end justify-center gap-4 pb-4">
        {second && <PodiumCard entry={second} position={2} />}
        {first && <PodiumCard entry={first} position={1} />}
        {third && <PodiumCard entry={third} position={3} />}
      </div>
    </div>
  )
}
