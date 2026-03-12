import { API_URL } from './constants'

export interface LiveStats {
  totalPredictors: number
  marketsResolvedToday: number
  predictionsScored: number
  totalVolume?: number
}

export interface LeaderboardEntry {
  rank: number
  address: string
  tier: number
  compositeScore: number
  accuracyScore: number
  alphaScore: number
  calibrationScore: number
  consistencyScore: number
  winRate: number
  totalPredictions: number
  pnl: number
  season?: number
}

export interface ProfileData {
  address: string
  tier: number
  compositeScore: number
  accuracyScore: number
  alphaScore: number
  calibrationScore: number
  consistencyScore: number
  winRate: number
  totalPredictions: number
  pnl: number
  bestCategory?: string
  seasonsActive: number
  badges?: Badge[]
  categoryPerformance?: CategoryPerformance[]
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earnedAt?: number
}

export interface CategoryPerformance {
  category: string
  predictions: number
  winRate: number
  pnl: number
  score: number
}

export interface Prediction {
  id: string
  marketId: string
  marketTitle: string
  prediction: string
  outcome?: string
  stake: number
  pnl?: number
  status: 'pending' | 'won' | 'lost' | 'resolved'
  createdAt: number
  resolvedAt?: number
  category?: string
}

export interface SeasonData {
  season: number
  score: number
  rank?: number
  predictions: number
  winRate: number
}

export interface CurrentSeason {
  id: number
  name: string
  startTime: number
  endTime: number
  status: 'active' | 'ended' | 'upcoming'
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export async function getLiveStats(): Promise<LiveStats> {
  try {
    return await fetchJson<LiveStats>(`${API_URL}/api/v1/stats/live`)
  } catch {
    return {
      totalPredictors: 0,
      marketsResolvedToday: 0,
      predictionsScored: 0,
    }
  }
}

export async function getLeaderboard(
  limit = 100,
  sort = 'composite',
  season?: number
): Promise<LeaderboardEntry[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit), sort })
    if (season !== undefined) params.set('season', String(season))
    return await fetchJson<LeaderboardEntry[]>(`${API_URL}/api/v1/leaderboard?${params}`)
  } catch {
    return []
  }
}

export async function getTop3(): Promise<LeaderboardEntry[]> {
  try {
    return await fetchJson<LeaderboardEntry[]>(`${API_URL}/api/v1/leaderboard/top3`)
  } catch {
    return []
  }
}

export async function getProfile(address: string): Promise<ProfileData | null> {
  try {
    return await fetchJson<ProfileData>(`${API_URL}/api/v1/profile/${address}`)
  } catch {
    return null
  }
}

export async function getProfileHistory(address: string, limit = 20): Promise<Prediction[]> {
  try {
    return await fetchJson<Prediction[]>(
      `${API_URL}/api/v1/profile/${address}/history?limit=${limit}`
    )
  } catch {
    return []
  }
}

export async function getCurrentSeason(): Promise<CurrentSeason | null> {
  try {
    return await fetchJson<CurrentSeason>(`${API_URL}/api/v1/seasons/current`)
  } catch {
    return null
  }
}

export interface SBTData {
  tokenId: string
  owner: string
  tier: number
  mintedAt: number
  lastEvolvedAt: number
  evolvedCount: number
}

export interface FeedEvent {
  id: string
  type: 'prediction_opened' | 'prediction_resolved' | 'tier_changed' | 'badge_earned' | 'score_jump'
  actor: string
  data: Record<string, unknown>
  blockNumber: number
  timestamp: number
}

export interface SeasonDetail {
  id: number
  name: string
  startBlock: number
  endBlock: number
  startTime: number
  endTime: number
  status: 'active' | 'ended' | 'upcoming'
  participantCount?: number
  topScorer?: string
  topScore?: number
}

export async function getSBTByOwner(address: string): Promise<SBTData | null> {
  try {
    return await fetchJson<SBTData>(`${API_URL}/api/v1/sbt/owner/${address}`)
  } catch {
    return null
  }
}

export async function getSBTById(tokenId: string): Promise<SBTData | null> {
  try {
    return await fetchJson<SBTData>(`${API_URL}/api/v1/sbt/${tokenId}`)
  } catch {
    return null
  }
}

export async function getProfileHistoryFiltered(
  address: string,
  params: { page?: number; limit?: number; category?: string; result?: string; dateFrom?: number; dateTo?: number }
): Promise<{ predictions: Prediction[]; total: number; stats: Record<string, number> }> {
  try {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.category) query.set('category', params.category)
    if (params.result) query.set('result', params.result)
    if (params.dateFrom) query.set('dateFrom', String(params.dateFrom))
    if (params.dateTo) query.set('dateTo', String(params.dateTo))
    return await fetchJson(`${API_URL}/api/v1/profile/${address}/history?${query}`)
  } catch {
    return { predictions: [], total: 0, stats: {} }
  }
}

export async function getSeasons(): Promise<SeasonDetail[]> {
  try {
    return await fetchJson<SeasonDetail[]>(`${API_URL}/api/v1/seasons`)
  } catch {
    return []
  }
}

export async function getSeasonDetail(id: number): Promise<SeasonDetail | null> {
  try {
    return await fetchJson<SeasonDetail>(`${API_URL}/api/v1/seasons/${id}`)
  } catch {
    return null
  }
}

export async function getSeasonLeaderboard(seasonId: number): Promise<LeaderboardEntry[]> {
  try {
    return await fetchJson<LeaderboardEntry[]>(`${API_URL}/api/v1/leaderboard/season/${seasonId}`)
  } catch {
    return []
  }
}

export async function getFeed(token: string): Promise<FeedEvent[]> {
  try {
    return await fetchJson<FeedEvent[]>(`${API_URL}/api/v1/social/feed`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch {
    return []
  }
}

export async function getFollowing(address: string): Promise<string[]> {
  try {
    return await fetchJson<string[]>(`${API_URL}/api/v1/social/${address}/following`)
  } catch {
    return []
  }
}

export async function getGlobalStats(): Promise<{ totalUsers: number; totalPredictions: number; marketsTracked: number }> {
  try {
    return await fetchJson(`${API_URL}/api/v1/stats/global`)
  } catch {
    return { totalUsers: 0, totalPredictions: 0, marketsTracked: 0 }
  }
}

export async function getLeaderboardByCategory(category: string): Promise<LeaderboardEntry[]> {
  try {
    return await fetchJson<LeaderboardEntry[]>(`${API_URL}/api/v1/leaderboard/category/${category}`)
  } catch {
    return []
  }
}
