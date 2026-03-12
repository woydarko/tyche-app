// src/routes/leaderboard.js — Leaderboard routes (BE-04)

import { query } from '../db/index.js';
import { getCachedLeaderboard, setCachedLeaderboard } from '../services/redis.js';
import { authenticate } from '../middleware/auth.js';
import config from '../config.js';

const TIER_NAMES = config.tiers;

function formatEntry(row, rank) {
  const tier = Number(row.tier ?? 0);
  return {
    rank,
    address: row.address,
    ensName: row.ens_name || null,
    compositeScore: Number(row.composite_score ?? 0),
    accuracyScore: Number(row.accuracy_score ?? 0),
    alphaScore: Number(row.alpha_score ?? 0),
    calibrationScore: Number(row.calibration_score ?? 0),
    consistencyScore: Number(row.consistency_score ?? 0),
    tier,
    tierName: TIER_NAMES[tier] || 'Bronze',
    totalPredictions: Number(row.total_predictions ?? 0),
    totalWins: Number(row.total_wins ?? 0),
    totalPnl: Number(row.total_pnl ?? 0),
    winRate: Number(row.total_predictions) > 0
      ? Number(row.total_wins) / Number(row.total_predictions)
      : 0,
  };
}

/**
 * GET /api/v1/leaderboard
 * Query: page, limit, sort (composite|accuracy|alpha|calibration|consistency), season, category
 */
async function getLeaderboard(request, reply) {
  const {
    page = '1',
    limit = '50',
    sort = 'composite',
    season,
    category,
  } = request.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  // Only cache first page global leaderboard
  const isFirstPageGlobal = pageNum === 1 && !season && !category;
  if (isFirstPageGlobal) {
    const cached = await getCachedLeaderboard();
    if (cached) {
      return reply.send({ ...cached, cached: true });
    }
  }

  const sortColumn = {
    composite: 's.composite_score',
    accuracy: 's.accuracy_score',
    alpha: 's.alpha_score',
    calibration: 's.calibration_score',
    consistency: 's.consistency_score',
  }[sort] || 's.composite_score';

  // Season-based leaderboard
  if (season) {
    return getSeasonLeaderboard(request, reply, season, pageNum, limitNum, offset);
  }

  // Category-filtered leaderboard
  if (category) {
    const conditions = ['cs.category = $1'];
    const params = [category, limitNum, offset];

    const res = await query(
      `SELECT w.address, w.ens_name,
              s.composite_score, s.accuracy_score, s.alpha_score, s.calibration_score, s.consistency_score,
              s.tier, s.total_predictions, s.total_wins, s.total_pnl,
              cs.mastery_score, cs.wins as cat_wins, cs.total as cat_total
       FROM category_scores cs
       JOIN wallets w ON cs.wallet = w.address
       JOIN scores s ON cs.wallet = s.address
       WHERE cs.category = $1
       ORDER BY cs.mastery_score DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    const countRes = await query(
      'SELECT COUNT(*) FROM category_scores WHERE category=$1',
      [category]
    );

    const total = Number(countRes.rows[0]?.count ?? 0);
    const entries = res.rows.map((r, i) => ({
      ...formatEntry(r, offset + i + 1),
      masteryScore: Number(r.mastery_score ?? 0),
      categoryWins: Number(r.cat_wins ?? 0),
      categoryTotal: Number(r.cat_total ?? 0),
    }));

    return reply.send({
      data: entries,
      meta: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum), category },
      cached: false,
    });
  }

  // Global leaderboard
  const res = await query(
    `SELECT w.address, w.ens_name,
            s.composite_score, s.accuracy_score, s.alpha_score, s.calibration_score, s.consistency_score,
            s.tier, s.total_predictions, s.total_wins, s.total_pnl
     FROM scores s
     JOIN wallets w ON s.address = w.address
     ORDER BY ${sortColumn} DESC
     LIMIT $1 OFFSET $2`,
    [limitNum, offset]
  );

  const countRes = await query('SELECT COUNT(*) FROM scores');
  const total = Number(countRes.rows[0]?.count ?? 0);

  const entries = res.rows.map((r, i) => formatEntry(r, offset + i + 1));

  const result = {
    data: entries,
    meta: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum), sort },
    cached: false,
  };

  if (isFirstPageGlobal) {
    await setCachedLeaderboard(result, 30);
  }

  return reply.send(result);
}

async function getSeasonLeaderboard(request, reply, seasonId, page, limit, offset) {
  const seasonRes = await query('SELECT * FROM seasons WHERE id=$1', [seasonId]);
  if (seasonRes.rows.length === 0) {
    return reply.status(404).send({ error: 'Season not found' });
  }

  const season = seasonRes.rows[0];
  if (!season.finalized || !season.top_predictors) {
    return reply.status(422).send({ error: 'Season not finalized yet' });
  }

  const topAddresses = season.top_predictors;
  const topScores = season.top_scores || [];

  const entries = topAddresses
    .map((addr, i) => ({
      rank: i + 1,
      address: addr,
      compositeScore: Number(topScores[i] ?? 0),
      tier: 0,
      tierName: 'Bronze',
    }))
    .filter((e) => e.address && e.address !== '0x0000000000000000000000000000000000000000')
    .slice(offset, offset + limit);

  return reply.send({
    data: entries,
    meta: { page, limit, total: topAddresses.length, season: Number(seasonId), finalized: true },
    cached: false,
  });
}

/**
 * GET /api/v1/leaderboard/top3
 */
async function getTop3(request, reply) {
  const res = await query(
    `SELECT w.address, w.ens_name,
            s.composite_score, s.accuracy_score, s.alpha_score, s.calibration_score, s.consistency_score,
            s.tier, s.total_predictions, s.total_wins, s.total_pnl
     FROM scores s
     JOIN wallets w ON s.address = w.address
     ORDER BY s.composite_score DESC
     LIMIT 3`,
    []
  );

  return reply.send({
    data: res.rows.map((r, i) => formatEntry(r, i + 1)),
  });
}

/**
 * GET /api/v1/leaderboard/category/:slug
 */
async function getCategoryLeaderboard(request, reply) {
  const { slug } = request.params;
  const { page = '1', limit = '50' } = request.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const res = await query(
    `SELECT w.address, w.ens_name,
            s.composite_score, s.accuracy_score, s.alpha_score, s.calibration_score, s.consistency_score,
            s.tier, s.total_predictions, s.total_wins, s.total_pnl,
            cs.mastery_score, cs.wins as cat_wins, cs.total as cat_total
     FROM category_scores cs
     JOIN wallets w ON cs.wallet = w.address
     JOIN scores s ON cs.wallet = s.address
     WHERE cs.category = $1
     ORDER BY cs.mastery_score DESC
     LIMIT $2 OFFSET $3`,
    [slug, limitNum, offset]
  );

  const countRes = await query(
    'SELECT COUNT(*) FROM category_scores WHERE category=$1',
    [slug]
  );

  const total = Number(countRes.rows[0]?.count ?? 0);

  return reply.send({
    data: res.rows.map((r, i) => ({
      ...formatEntry(r, offset + i + 1),
      masteryScore: Number(r.mastery_score ?? 0),
      categoryWins: Number(r.cat_wins ?? 0),
      categoryTotal: Number(r.cat_total ?? 0),
      categoryWinRate: Number(r.cat_total) > 0
        ? Number(r.cat_wins) / Number(r.cat_total) : 0,
    })),
    meta: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum), category: slug },
  });
}

/**
 * GET /api/v1/leaderboard/season/:seasonId
 */
async function getSeasonLeaderboardRoute(request, reply) {
  const { seasonId } = request.params;
  const { page = '1', limit = '50' } = request.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  return getSeasonLeaderboard(request, reply, seasonId, pageNum, limitNum, offset);
}

/**
 * GET /api/v1/leaderboard/my-rank (authenticated)
 */
async function getMyRank(request, reply) {
  const address = request.user?.address;
  if (!address) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const addr = address.toLowerCase();

  const res = await query(
    `SELECT rank, composite_score, tier FROM (
       SELECT address, composite_score, tier,
              RANK() OVER (ORDER BY composite_score DESC) as rank
       FROM scores
     ) ranked
     WHERE address = $1`,
    [addr]
  );

  if (res.rows.length === 0) {
    return reply.status(404).send({ error: 'Not ranked yet — no predictions found' });
  }

  const r = res.rows[0];
  const tier = Number(r.tier ?? 0);

  return reply.send({
    data: {
      address: addr,
      rank: Number(r.rank),
      compositeScore: Number(r.composite_score ?? 0),
      tier,
      tierName: TIER_NAMES[tier] || 'Bronze',
    },
  });
}

/**
 * Register leaderboard routes.
 */
export async function leaderboardRoutes(fastify, options) {
  fastify.get('/', getLeaderboard);
  fastify.get('/top3', getTop3);
  fastify.get('/category/:slug', getCategoryLeaderboard);
  fastify.get('/season/:seasonId', getSeasonLeaderboardRoute);
  fastify.get('/my-rank', { preHandler: authenticate }, getMyRank);
}
