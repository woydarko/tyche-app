// src/middleware/auth.js — SIWE authentication + JWT middleware

import { SiweMessage } from 'siwe';
import { cacheGet, cacheSet } from '../services/redis.js';

const NONCE_TTL = 300; // 5 minutes

// ── Nonce helpers ─────────────────────────────────────────────────────────────

function generateNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function storeNonce(address, nonce) {
  const key = `tyche:nonce:${address.toLowerCase()}`;
  await cacheSet(key, { nonce, usedAt: null }, NONCE_TTL);
}

async function consumeNonce(address, nonce) {
  const key = `tyche:nonce:${address.toLowerCase()}`;
  try {
    const stored = await cacheGet(key);
    if (!stored || stored.nonce !== nonce) return false;
    // Invalidate nonce after use
    await cacheSet(key, null, 1);
    return true;
  } catch {
    // If Redis is down, allow nonce (graceful fallback)
    return true;
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/nonce
 * Returns a fresh nonce for the given wallet address.
 */
export async function nonceHandler(request, reply) {
  const { address } = request.query;

  if (!address) {
    return reply.status(400).send({ error: 'address query param required' });
  }

  const nonce = generateNonce();
  await storeNonce(address, nonce);

  return reply.send({ nonce });
}

/**
 * POST /api/v1/auth/verify
 * Verifies a SIWE message and signature, returns a JWT on success.
 */
export async function verifyHandler(request, reply) {
  const { message, signature } = request.body;

  if (!message || !signature) {
    return reply.status(400).send({ error: 'message and signature required' });
  }

  try {
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (!fields.success) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    const address = fields.data.address.toLowerCase();

    // Validate nonce
    const valid = await consumeNonce(address, fields.data.nonce);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid or expired nonce' });
    }

    // Issue JWT
    const token = await reply.jwtSign(
      { address, iat: Math.floor(Date.now() / 1000) },
      { expiresIn: '7d' }
    );

    return reply.send({ token, address });
  } catch (err) {
    console.error('[Auth] verify error:', err.message);
    return reply.status(401).send({ error: 'Verification failed: ' + err.message });
  }
}

/**
 * Fastify preHandler hook for protected routes.
 * Attaches `request.user = { address }` on success.
 */
export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: ' + err.message });
  }
}

/**
 * Register auth routes on a Fastify instance.
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function authRoutes(fastify, options) {
  fastify.get('/nonce', nonceHandler);
  fastify.post('/verify', verifyHandler);
}
