// src/routes/profile.js — Profile routes (BE-03)

import { query } from '../db/index.js';
import { getCachedProfile, setCachedProfile } from '../services/redis.js';
import { resolveENS } from '../services/ens.js';
import config from '../config.js';

const TIER_NAMES = config.tiers;

/**
 * Build a full public profile for a wallet address.
 */
async function buildProfile(address) {
  const addr = address.toLowerCase();

  // Wallet + score
  const walletRes = await query(
    `SELECT w.address, w.ens_name, w.created_at,
            s.accuracy_score, s.alpha_score, s.calibration_score, s.consistency_score,
            s.composite_score, s.tier, s.total_predictions, s.total_wins, s.total_pnl,
            s.last_update_block, s.updated_at as score_updated_at
     FROM wallets w
     LEFT JOIN scores s ON w.address = s.address
     WHERE w.address = $1`,
    [addr]
  );

  if (walletRes.rows.length === 0) {
    return null;
  }

  const w = walletRes.rows[0];

  // Resolve ENS if not cached
  let ensName = w.ens_name;
  if (!ensName) {
    ensName = await resolveENS(addr);
    if (ensName) {
      await query('UPDATE wallets SET ens_name=$1, updated_at=NOW() WHERE address=$2', [ensName, addr]);
    }
  }

  // Category scores
  const catRes = await query(
    `SELECT category, wins, total, mastery_score FROM category_scores WHERE wallet=$1 ORDER BY mastery_score DESC`,
    [addr]
  );

  // Badges
  const badgeRes = await query(
    `SELECT id, season_id, badge_type, metadata, earned_at FROM badges WHERE wallet=$1 ORDER BY earned_at DESC`,
    [addr]
  );

  // Social counts
  const followingRes = await query('SELECT COUNT(*) FROM social_follows WHERE follower=$1', [addr]);
  const followersRes = await query('SELECT COUNT(*) FROM social_follows WHERE target=$1', [addr]);

  const tier = Number(w.tier ?? 0);

  return {
    address: addr,
    ensName: ensName || null,
    createdAt: w.created_at,
    scores: {
      accuracyScore: Number(w.accuracy_score ?? 0),
      alphaScore: Number(w.alpha_score ?? 0),
      calibrationScore: Number(w.calibration_score ?? 0),
      consistencyScore: Number(w.consistency_score ?? 0),
      compositeScore: Number(w.composite_score ?? 0),
      tier,
      tierName: TIER_NAMES[tier] || 'Bronze',
      totalPredictions: Number(w.total_predictions ?? 0),
      totalWins: Number(w.total_wins ?? 0),
      totalPnl: w.total_pnl ? Number(w.total_pnl) : 0,
      lastUpdateBlock: Number(w.last_update_block ?? 0),
      updatedAt: w.score_updated_at,
    },
    categoryScores: catRes.rows.map((r) => ({
      category: r.category,
      wins: Number(r.wins),
      total: Number(r.total),
      masteryScore: Number(r.mastery_score),
      winRate: r.total > 0 ? Number(r.wins) / Number(r.total) : 0,
    })),
    badges: badgeRes.rows.map((b) => ({
      id: b.id,
      seasonId: b.season_id,
      type: b.badge_type,
      metadata: b.metadata,
      earnedAt: b.earned_at,
    })),
    social: {
      following: Number(followingRes.rows[0]?.count ?? 0),
      followers: Number(followersRes.rows[0]?.count ?? 0),
    },
  };
}

/**
 * GET /api/v1/profile/:address
 */
async function getProfile(request, reply) {
  const { address } = request.params;

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return reply.status(400).send({ error: 'Invalid address' });
  }

  const addr = address.toLowerCase();

  // Check cache
  const cached = await getCachedProfile(addr);
  if (cached) {
    return reply.send({ data: cached, cached: true });
  }

  const profile = await buildProfile(addr);

  if (!profile) {
    return reply.status(404).send({ error: 'Profile not found' });
  }

  await setCachedProfile(addr, profile, 60);

  return reply.send({ data: profile, cached: false });
}

/**
 * GET /api/v1/profile/:address/history
 * Query params: page, limit, category, platform, result, minStake, dateFrom, dateTo
 */
async function getPredictionHistory(request, reply) {
  const { address } = request.params;
  const {
    page = '1',
    limit = '20',
    category,
    platform,
    result,
    minStake,
    dateFrom,
    dateTo,
  } = request.query;

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return reply.status(400).send({ error: 'Invalid address' });
  }

  const addr = address.toLowerCase();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Build dynamic query
  const conditions = ['p.wallet = $1'];
  const params = [addr];
  let paramIdx = 2;

  if (category) {
    conditions.push(`p.category = $${paramIdx++}`);
    params.push(category);
  }
  if (platform) {
    conditions.push(`p.platform = $${paramIdx++}`);
    params.push(platform);
  }
  if (result && ['WIN', 'LOSS', 'PENDING'].includes(result.toUpperCase())) {
    conditions.push(`p.result = $${paramIdx++}`);
    params.push(result.toUpperCase());
  }
  if (minStake) {
    conditions.push(`p.amount >= $${paramIdx++}`);
    params.push(Number(minStake));
  }
  if (dateFrom) {
    conditions.push(`p.created_at >= $${paramIdx++}`);
    params.push(new Date(dateFrom));
  }
  if (dateTo) {
    conditions.push(`p.created_at <= $${paramIdx++}`);
    params.push(new Date(dateTo));
  }

  const where = conditions.join(' AND ');

  const [rowsRes, countRes, statsRes] = await Promise.all([
    query(
      `SELECT p.id, p.market_id, p.category, p.platform, p.position, p.entry_odds, p.exit_odds,
              p.amount, p.result, p.pnl, p.score_impact, p.block_number, p.created_at, p.settled_at,
              m.title as market_title
       FROM predictions p
       LEFT JOIN markets m ON p.market_id = m.market_id
       WHERE ${where}
       ORDER BY p.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limitNum, offset]
    ),
    query(
      `SELECT COUNT(*) FROM predictions p WHERE ${where}`,
      params
    ),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE result = 'WIN') as wins,
         COUNT(*) FILTER (WHERE result = 'LOSS') as losses,
         COUNT(*) FILTER (WHERE result = 'PENDING') as pending,
         SUM(CASE WHEN pnl IS NOT NULL THEN pnl ELSE 0 END) as total_pnl,
         SUM(amount) as total_staked,
         AVG(entry_odds) as avg_odds
       FROM predictions p WHERE ${where}`,
      params
    ),
  ]);

  const total = Number(countRes.rows[0]?.count ?? 0);
  const stats = statsRes.rows[0];

  return reply.send({
    data: rowsRes.rows.map((r) => ({
      id: r.id,
      marketId: r.market_id,
      marketTitle: r.market_title,
      category: r.category,
      platform: r.platform,
      position: r.position,
      entryOdds: r.entry_odds ? Number(r.entry_odds) : null,
      exitOdds: r.exit_odds ? Number(r.exit_odds) : null,
      amount: r.amount ? Number(r.amount) : null,
      result: r.result,
      pnl: r.pnl ? Number(r.pnl) : null,
      scoreImpact: r.score_impact ? Number(r.score_impact) : null,
      blockNumber: Number(r.block_number),
      createdAt: r.created_at,
      settledAt: r.settled_at,
    })),
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
    stats: {
      wins: Number(stats?.wins ?? 0),
      losses: Number(stats?.losses ?? 0),
      pending: Number(stats?.pending ?? 0),
      totalPnl: Number(stats?.total_pnl ?? 0),
      totalStaked: Number(stats?.total_staked ?? 0),
      avgOdds: stats?.avg_odds ? Number(stats.avg_odds) : null,
      winRate: (Number(stats?.wins ?? 0) + Number(stats?.losses ?? 0)) > 0
        ? Number(stats?.wins ?? 0) / (Number(stats?.wins ?? 0) + Number(stats?.losses ?? 0))
        : 0,
    },
  });
}

/**
 * Register profile routes.
 */
export async function profileRoutes(fastify, options) {
  fastify.get('/:address', getProfile);
  fastify.get('/:address/history', getPredictionHistory);
}
