export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const CONTRACT_ADDRESSES = {
  SCORE_REGISTRY: process.env.NEXT_PUBLIC_SCORE_REGISTRY_ADDRESS || '0x90ab2482E83BE7A1Ae550b8C789bc6701267adA0',
  MARKET_ADAPTER: process.env.NEXT_PUBLIC_MARKET_ADAPTER_ADDRESS || '0x3728Df6fF0cCcEeFd6E98c88beeCfc308Af4F1E4',
  SEASON_MANAGER: process.env.NEXT_PUBLIC_SEASON_MANAGER_ADDRESS || '0x2720aE609232892118aDC314f44679dB13F50267',
  MOCK_MARKET: process.env.NEXT_PUBLIC_MOCK_MARKET_ADDRESS || '0xA278c23F935980d903E8Da3d25379b2B5Ec3D16a',
} as const

export const SOMNIA_CHAIN_ID = 50312

export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Oracle'] as const
export type TierName = typeof TIER_NAMES[number]

export const TIER_COLORS: Record<number, string> = {
  0: '#cd7f32',
  1: '#c0c0c0',
  2: '#ffd700',
  3: '#e5e4e2',
  4: '#c084fc',
}

export const TIER_BG_COLORS: Record<number, string> = {
  0: 'rgba(205, 127, 50, 0.15)',
  1: 'rgba(192, 192, 192, 0.15)',
  2: 'rgba(255, 215, 0, 0.15)',
  3: 'rgba(229, 228, 226, 0.15)',
  4: 'rgba(192, 132, 252, 0.15)',
}

export const SCORE_DIMENSIONS = ['Accuracy', 'Alpha', 'Calibration', 'Consistency', 'Composite'] as const
export type ScoreDimension = typeof SCORE_DIMENSIONS[number]

export const MAX_SCORE = 10000
