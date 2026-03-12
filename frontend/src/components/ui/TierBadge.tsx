import { tierName, tierColor, tierBgColor } from '@/lib/utils'

interface TierBadgeProps {
  tier: number
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

const TIER_ICONS = ['🥉', '🥈', '🥇', '💠', '🔮']

export default function TierBadge({ tier, size = 'md', showIcon = true }: TierBadgeProps) {
  const name = tierName(tier)
  const color = tierColor(tier)
  const bg = tierBgColor(tier)
  const icon = TIER_ICONS[Math.min(tier, TIER_ICONS.length - 1)]

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border ${sizeClasses[size]}`}
      style={{
        color,
        backgroundColor: bg,
        borderColor: `${color}40`,
      }}
    >
      {showIcon && <span className="leading-none">{icon}</span>}
      {name}
    </span>
  )
}
