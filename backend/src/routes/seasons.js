// src/routes/seasons.js — Season routes (BE-05)

import { query } from '../db/index.js';

function formatSeason(s) {
  return {
    id: Number(s.id),
    startBlock: Number(s.start_block),
    endBlock: Number(s.end_block),
    finalized: s.finalized,
    topPredictors: s.top_predictors || [],
    topScores: s.top_scores || [],
    createdAt: s.created_at,
    finalizedAt: s.finalized_at,
  };
}

/**
 * GET /api/v1/seasons
 */
async function listSeasons(request, reply) {
  const res = await query(
    `SELECT * FROM seasons ORDER BY id DESC`,
    []
  );

  return reply.send({
    data: res.rows.map(formatSeason),
    total: res.rows.length,
  });
}

/**
 * GET /api/v1/seasons/current
 */
async function getCurrentSeason(request, reply) {
  const res = await query(
    `SELECT * FROM seasons WHERE finalized = FALSE ORDER BY id DESC LIMIT 1`,
    []
  );

  if (res.rows.length === 0) {
    // Try to return the last season even if finalized
    const lastRes = await query('SELECT * FROM seasons ORDER BY id DESC LIMIT 1', []);
    if (lastRes.rows.length === 0) {
      return reply.status(404).send({ error: 'No seasons found' });
    }
    const s = lastRes.rows[0];
    return reply.send({
      data: {
        ...formatSeason(s),
        blocksRemaining: 0,
        isActive: false,
      },
    });
  }

  const s = res.rows[0];

  // Get current block estimate — use last_update_block from scores as proxy
  const blockRes = await query('SELECT MAX(last_update_block) as latest_block FROM scores', []);
  const currentBlock = Number(blockRes.rows[0]?.latest_block ?? 0);
  const blocksRemaining = Math.max(0, Number(s.end_block) - currentBlock);

  return reply.send({
    data: {
      ...formatSeason(s),
      currentBlock,
      blocksRemaining,
      isActive: !s.finalized && currentBlock < Number(s.end_block),
      // Emit warning if < 5000 blocks remaining (~80 minutes on Somnia)
      warningThreshold: blocksRemaining < 5000 && blocksRemaining > 0,
    },
  });
}

/**
 * GET /api/v1/seasons/:id
 */
async function getSeasonById(request, reply) {
  const { id } = request.params;

  const res = await query('SELECT * FROM seasons WHERE id=$1', [id]);

  if (res.rows.length === 0) {
    return reply.status(404).send({ error: 'Season not found' });
  }

  const s = res.rows[0];

  // Enrich top predictors with profile data if available
  let enrichedTopPredictors = [];
  if (s.top_predictors && Array.isArray(s.top_predictors)) {
    const addrs = s.top_predictors
      .filter((a) => a && a !== '0x0000000000000000000000000000000000000000')
      .map((a) => a.toLowerCase());

    if (addrs.length > 0) {
      const profileRes = await query(
        `SELECT s.address, s.composite_score, s.tier, w.ens_name
         FROM scores s
         JOIN wallets w ON s.address = w.address
         WHERE s.address = ANY($1)`,
        [addrs]
      );

      const profileMap = {};
      for (const p of profileRes.rows) {
        profileMap[p.address] = p;
      }

      enrichedTopPredictors = addrs.map((addr, i) => ({
        rank: i + 1,
        address: addr,
        ensName: profileMap[addr]?.ens_name || null,
        compositeScore: Number(s.top_scores?.[i] ?? profileMap[addr]?.composite_score ?? 0),
        tier: Number(profileMap[addr]?.tier ?? 0),
      }));
    }
  }

  return reply.send({
    data: {
      ...formatSeason(s),
      enrichedTopPredictors,
    },
  });
}

/**
 * GET /api/v1/seasons/:id/badges
 */
async function getSeasonBadges(request, reply) {
  const { id } = request.params;

  const seasonRes = await query('SELECT id FROM seasons WHERE id=$1', [id]);
  if (seasonRes.rows.length === 0) {
    return reply.status(404).send({ error: 'Season not found' });
  }

  const res = await query(
    `SELECT b.id, b.wallet, b.badge_type, b.metadata, b.earned_at, w.ens_name
     FROM badges b
     LEFT JOIN wallets w ON b.wallet = w.address
     WHERE b.season_id = $1
     ORDER BY b.earned_at ASC`,
    [id]
  );

  return reply.send({
    data: res.rows.map((b) => ({
      id: b.id,
      wallet: b.wallet,
      ensName: b.ens_name || null,
      badgeType: b.badge_type,
      metadata: b.metadata,
      earnedAt: b.earned_at,
    })),
    total: res.rows.length,
  });
}

/**
 * Register season routes.
 */
export async function seasonRoutes(fastify, options) {
  fastify.get('/', listSeasons);
  fastify.get('/current', getCurrentSeason);
  fastify.get('/:id', getSeasonById);
  fastify.get('/:id/badges', getSeasonBadges);
}
