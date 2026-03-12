import { TIER_NAMES, TIER_COLORS, TIER_BG_COLORS, type TierName } from './constants'

export function formatAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function tierName(tier: number): TierName {
  return TIER_NAMES[Math.min(tier, TIER_NAMES.length - 1)] ?? 'Bronze'
}

export function tierColor(tier: number): string {
  return TIER_COLORS[tier] ?? TIER_COLORS[0]
}

export function tierBgColor(tier: number): string {
  return TIER_BG_COLORS[tier] ?? TIER_BG_COLORS[0]
}

export function formatPnL(pnl: number): string {
  const sign = pnl >= 0 ? '+' : ''
  if (Math.abs(pnl) >= 1000) {
    return `${sign}${(pnl / 1000).toFixed(1)}k`
  }
  return `${sign}${pnl.toFixed(2)}`
}

export function formatScore(score: number): string {
  return score.toLocaleString()
}

export function formatWinRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function timeAgo(date: Date | number): string {
  const seconds = Math.floor((Date.now() - (typeof date === 'number' ? date : date.getTime())) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function normalizeScore(score: number, max = 10000): number {
  return Math.min((score / max) * 100, 100)
}

export function getScoreColor(score: number): string {
  if (score >= 8000) return 'text-purple-400'
  if (score >= 6000) return 'text-yellow-400'
  if (score >= 4000) return 'text-blue-400'
  if (score >= 2000) return 'text-green-400'
  return 'text-gray-400'
}
