// src/routes/stats.js — Global statistics routes (BE-08)

import { query } from '../db/index.js';
import { cacheGet, cacheSet } from '../services/redis.js';
import config from '../config.js';

const TIER_NAMES = config.tiers;

/**
 * GET /api/v1/stats/global
 */
async function getGlobalStats(request, reply) {
  const cacheKey = 'tyche:stats:global';
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return reply.send({ ...cached, cached: true });
  }

  const [usersRes, predictionsRes, marketsRes, scoresRes, tierRes] = await Promise.all([
    query('SELECT COUNT(*) FROM wallets', []),
    query(`SELECT COUNT(*), COUNT(*) FILTER (WHERE result='WIN') as wins,
                  COUNT(*) FILTER (WHERE result='LOSS') as losses,
                  SUM(amount) as total_volume FROM predictions`, []),
    query('SELECT COUNT(*), COUNT(*) FILTER (WHERE resolved=TRUE) as resolved FROM markets', []),
    query('SELECT AVG(composite_score) as avg_score, MAX(composite_score) as max_score FROM scores', []),
    query('SELECT tier, COUNT(*) FROM scores GROUP BY tier ORDER BY tier', []),
  ]);

  const predStats = predictionsRes.rows[0];
  const marketStats = marketsRes.rows[0];
  const scoreStats = scoresRes.rows[0];

  const tierBreakdown = {};
  for (const r of tierRes.rows) {
    const t = Number(r.tier);
    tierBreakdown[TIER_NAMES[t] || `tier_${t}`] = Number(r.count);
  }

  const result = {
    data: {
      totalUsers: Number(usersRes.rows[0]?.count ?? 0),
      totalPredictions: Number(predStats?.count ?? 0),
      totalWins: Number(predStats?.wins ?? 0),
      totalLosses: Number(predStats?.losses ?? 0),
      totalVolume: Number(predStats?.total_volume ?? 0),
      totalMarkets: Number(marketStats?.count ?? 0),
      resolvedMarkets: Number(marketStats?.resolved ?? 0),
      avgCompositeScore: Number(scoreStats?.avg_score ?? 0),
      maxCompositeScore: Number(scoreStats?.max_score ?? 0),
      tierBreakdown,
    },
    cached: false,
  };

  await cacheSet(cacheKey, result, 60);

  return reply.send(result);
}

/**
 * GET /api/v1/stats/live
 * Real-time counters (shorter cache).
 */
async function getLiveStats(request, reply) {
  const cacheKey = 'tyche:stats:live';
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return reply.send({ ...cached, cached: true });
  }

  const [recentPredictions, activeBettors, pendingBets, recentActivity] = await Promise.all([
    query(
      `SELECT COUNT(*) FROM predictions WHERE created_at > NOW() - INTERVAL '1 hour'`,
      []
    ),
    query(
      `SELECT COUNT(DISTINCT wallet) FROM predictions WHERE created_at > NOW() - INTERVAL '24 hours'`,
      []
    ),
    query(`SELECT COUNT(*) FROM predictions WHERE result = 'PENDING'`, []),
    query(
      `SELECT COUNT(*) FROM feed_events WHERE created_at > NOW() - INTERVAL '1 hour'`,
      []
    ),
  ]);

  const result = {
    data: {
      predictionsLastHour: Number(recentPredictions.rows[0]?.count ?? 0),
      activeBettors24h: Number(activeBettors.rows[0]?.count ?? 0),
      pendingBets: Number(pendingBets.rows[0]?.count ?? 0),
      feedEventsLastHour: Number(recentActivity.rows[0]?.count ?? 0),
      timestamp: new Date().toISOString(),
    },
    cached: false,
  };

  await cacheSet(cacheKey, result, 15); // 15-second cache for live stats

  return reply.send(result);
}

/**
 * GET /api/v1/stats/categories
 * Activity breakdown per category.
 */
async function getCategoryStats(request, reply) {
  const cacheKey = 'tyche:stats:categories';
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return reply.send({ ...cached, cached: true });
  }

  const [predByCategory, topCategories] = await Promise.all([
    query(
      `SELECT category,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE result='WIN') as wins,
              COUNT(*) FILTER (WHERE result='LOSS') as losses,
              COUNT(*) FILTER (WHERE result='PENDING') as pending,
              SUM(amount) as volume,
              COUNT(DISTINCT wallet) as unique_bettors
       FROM predictions
       WHERE category IS NOT NULL
       GROUP BY category
       ORDER BY total DESC`,
      []
    ),
    query(
      `SELECT category, SUM(mastery_score) as total_mastery, COUNT(*) as active_users
       FROM category_scores
       WHERE category IS NOT NULL
       GROUP BY category
       ORDER BY active_users DESC
       LIMIT 10`,
      []
    ),
  ]);

  const topCategoryMap = {};
  for (const r of topCategories.rows) {
    topCategoryMap[r.category] = {
      activeMasters: Number(r.active_users),
      totalMastery: Number(r.total_mastery),
    };
  }

  const result = {
    data: predByCategory.rows.map((r) => ({
      category: r.category,
      total: Number(r.total),
      wins: Number(r.wins),
      losses: Number(r.losses),
      pending: Number(r.pending),
      volume: Number(r.volume ?? 0),
      uniqueBettors: Number(r.unique_bettors),
      winRate: (Number(r.wins) + Number(r.losses)) > 0
        ? Number(r.wins) / (Number(r.wins) + Number(r.losses))
        : 0,
      ...(topCategoryMap[r.category] || {}),
    })),
    cached: false,
  };

  await cacheSet(cacheKey, result, 120); // 2-minute cache

  return reply.send(result);
}

/**
 * Register stats routes.
 */
export async function statsRoutes(fastify, options) {
  fastify.get('/global', getGlobalStats);
  fastify.get('/live', getLiveStats);
  fastify.get('/categories', getCategoryStats);
}
