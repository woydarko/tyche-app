import { type ProfileData } from '@/lib/api'
import { formatTimestamp } from '@/lib/utils'

interface BadgesShelfProps {
  profile: ProfileData
}

const DEFAULT_BADGES = [
  {
    id: 'first-prediction',
    name: 'First Call',
    description: 'Made your first prediction',
    icon: '🎯',
    rarity: 'common',
  },
  {
    id: 'win-streak-5',
    name: 'Hot Streak',
    description: '5 correct predictions in a row',
    icon: '🔥',
    rarity: 'uncommon',
  },
  {
    id: 'oracle-tier',
    name: 'Oracle Ascendant',
    description: 'Reached Oracle tier',
    icon: '🔮',
    rarity: 'legendary',
  },
  {
    id: 'alpha-hunter',
    name: 'Alpha Hunter',
    description: 'Top alpha score in a season',
    icon: '⚡',
    rarity: 'rare',
  },
]

const RARITY_STYLES: Record<string, string> = {
  common: 'border-gray-700 bg-gray-800/50',
  uncommon: 'border-green-700/30 bg-green-950/20',
  rare: 'border-blue-700/30 bg-blue-950/20',
  epic: 'border-purple-600/30 bg-purple-950/20',
  legendary: 'border-yellow-500/30 bg-yellow-950/20',
}

export default function BadgesShelf({ profile }: BadgesShelfProps) {
  const badges = profile.badges && profile.badges.length > 0 ? profile.badges : null

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Badges</h3>
        {badges && (
          <span className="text-sm text-gray-400">
            {badges.length} earned
          </span>
        )}
      </div>

      {badges ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className="group rounded-lg border border-gray-700 bg-gray-800/50 p-3 flex flex-col items-center text-center hover:border-purple-500/30 transition-colors cursor-default"
              title={badge.description}
            >
              <span className="text-2xl mb-2">{badge.icon}</span>
              <span className="text-xs font-medium text-white leading-tight">{badge.name}</span>
              {badge.earnedAt && (
                <span className="text-xs text-gray-500 mt-1">
                  {formatTimestamp(badge.earnedAt)}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-400 mb-4">
            No badges earned yet. Start predicting to earn achievements!
          </p>
          {/* Preview of available badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DEFAULT_BADGES.map((badge) => (
              <div
                key={badge.id}
                className={`rounded-lg border p-3 flex flex-col items-center text-center opacity-40 ${
                  RARITY_STYLES[badge.rarity]
                }`}
              >
                <span className="text-2xl mb-2 grayscale">{badge.icon}</span>
                <span className="text-xs font-medium text-white leading-tight">{badge.name}</span>
                <span className="text-xs text-gray-500 mt-1 capitalize">{badge.rarity}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3 text-center">
            {DEFAULT_BADGES.length}+ badges available to earn
          </p>
        </div>
      )}
    </div>
  )
}
