// src/routes/social.js — Social follow + feed routes (BE-06)

import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

/**
 * GET /api/v1/social/following/:address
 */
async function getFollowing(request, reply) {
  const { address } = request.params;

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return reply.status(400).send({ error: 'Invalid address' });
  }

  const addr = address.toLowerCase();
  const res = await query(
    `SELECT sf.target, sf.created_at, sf.block_number, w.ens_name,
            s.composite_score, s.tier
     FROM social_follows sf
     LEFT JOIN wallets w ON sf.target = w.address
     LEFT JOIN scores s ON sf.target = s.address
     WHERE sf.follower = $1
     ORDER BY sf.created_at DESC`,
    [addr]
  );

  return reply.send({
    data: res.rows.map((r) => ({
      address: r.target,
      ensName: r.ens_name || null,
      compositeScore: Number(r.composite_score ?? 0),
      tier: Number(r.tier ?? 0),
      followedAt: r.created_at,
      blockNumber: Number(r.block_number),
    })),
    total: res.rows.length,
  });
}

/**
 * GET /api/v1/social/followers/:address
 */
async function getFollowers(request, reply) {
  const { address } = request.params;

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return reply.status(400).send({ error: 'Invalid address' });
  }

  const addr = address.toLowerCase();
  const res = await query(
    `SELECT sf.follower, sf.created_at, sf.block_number, w.ens_name,
            s.composite_score, s.tier
     FROM social_follows sf
     LEFT JOIN wallets w ON sf.follower = w.address
     LEFT JOIN scores s ON sf.follower = s.address
     WHERE sf.target = $1
     ORDER BY sf.created_at DESC`,
    [addr]
  );

  return reply.send({
    data: res.rows.map((r) => ({
      address: r.follower,
      ensName: r.ens_name || null,
      compositeScore: Number(r.composite_score ?? 0),
      tier: Number(r.tier ?? 0),
      followedAt: r.created_at,
      blockNumber: Number(r.block_number),
    })),
    total: res.rows.length,
  });
}

/**
 * POST /api/v1/social/follow (authenticated)
 * Body: { target: string }
 * Note: This writes to the DB directly. The actual on-chain follow must be done
 * via the TycheSocial contract separately.
 */
async function follow(request, reply) {
  const follower = request.user?.address?.toLowerCase();
  if (!follower) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const { target } = request.body;

  if (!target || !/^0x[0-9a-fA-F]{40}$/.test(target)) {
    return reply.status(400).send({ error: 'Invalid target address' });
  }

  const targetAddr = target.toLowerCase();

  if (follower === targetAddr) {
    return reply.status(400).send({ error: 'Cannot follow yourself' });
  }

  // Check if already following
  const existing = await query(
    'SELECT 1 FROM social_follows WHERE follower=$1 AND target=$2',
    [follower, targetAddr]
  );

  if (existing.rows.length > 0) {
    return reply.status(409).send({ error: 'Already following' });
  }

  // Ensure wallets exist
  await query(
    `INSERT INTO wallets (address, created_at, updated_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT (address) DO NOTHING`,
    [follower]
  );
  await query(
    `INSERT INTO wallets (address, created_at, updated_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT (address) DO NOTHING`,
    [targetAddr]
  );

  await query(
    `INSERT INTO social_follows (follower, target, created_at, block_number)
     VALUES ($1,$2,NOW(),0)`,
    [follower, targetAddr]
  );

  return reply.status(201).send({
    data: { follower, target: targetAddr, createdAt: new Date().toISOString() },
  });
}

/**
 * DELETE /api/v1/social/follow (authenticated)
 * Body: { target: string }
 */
async function unfollow(request, reply) {
  const follower = request.user?.address?.toLowerCase();
  if (!follower) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const { target } = request.body;

  if (!target || !/^0x[0-9a-fA-F]{40}$/.test(target)) {
    return reply.status(400).send({ error: 'Invalid target address' });
  }

  const targetAddr = target.toLowerCase();

  const res = await query(
    'DELETE FROM social_follows WHERE follower=$1 AND target=$2 RETURNING follower',
    [follower, targetAddr]
  );

  if (res.rows.length === 0) {
    return reply.status(404).send({ error: 'Not following this address' });
  }

  return reply.send({ data: { unfollowed: true } });
}

/**
 * GET /api/v1/social/feed (authenticated)
 * Returns paginated activity from followed wallets, ordered by block_number DESC.
 * Query: page, limit
 */
async function getFeed(request, reply) {
  const address = request.user?.address?.toLowerCase();
  if (!address) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const { page = '1', limit = '20' } = request.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Get all wallets this user follows
  const followingRes = await query(
    'SELECT target FROM social_follows WHERE follower=$1',
    [address]
  );

  if (followingRes.rows.length === 0) {
    return reply.send({
      data: [],
      meta: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
    });
  }

  const followedAddresses = followingRes.rows.map((r) => r.target);

  const [feedRes, countRes] = await Promise.all([
    query(
      `SELECT fe.id, fe.event_type, fe.actor_wallet, fe.related_wallet, fe.market_id,
              fe.metadata, fe.block_number, fe.created_at,
              w.ens_name as actor_ens,
              m.title as market_title, m.category as market_category
       FROM feed_events fe
       LEFT JOIN wallets w ON fe.actor_wallet = w.address
       LEFT JOIN markets m ON fe.market_id = m.market_id
       WHERE fe.actor_wallet = ANY($1)
       ORDER BY fe.block_number DESC, fe.created_at DESC
       LIMIT $2 OFFSET $3`,
      [followedAddresses, limitNum, offset]
    ),
    query(
      'SELECT COUNT(*) FROM feed_events WHERE actor_wallet = ANY($1)',
      [followedAddresses]
    ),
  ]);

  const total = Number(countRes.rows[0]?.count ?? 0);

  return reply.send({
    data: feedRes.rows.map((e) => ({
      id: e.id,
      type: e.event_type,
      actor: {
        address: e.actor_wallet,
        ensName: e.actor_ens || null,
      },
      relatedWallet: e.related_wallet,
      marketId: e.market_id,
      marketTitle: e.market_title || null,
      marketCategory: e.market_category || null,
      metadata: e.metadata,
      blockNumber: Number(e.block_number),
      createdAt: e.created_at,
    })),
    meta: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}

/**
 * Register social routes.
 */
export async function socialRoutes(fastify, options) {
  fastify.get('/following/:address', getFollowing);
  fastify.get('/followers/:address', getFollowers);
  fastify.post('/follow', { preHandler: authenticate }, follow);
  fastify.delete('/follow', { preHandler: authenticate }, unfollow);
  fastify.get('/feed', { preHandler: authenticate }, getFeed);
}
