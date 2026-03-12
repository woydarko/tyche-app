// src/index.js — Tyche Backend main entry point

import { createServer } from 'http';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';

import config from './config.js';
import { pool } from './db/index.js';
import { setupWebSocket } from './websocket/index.js';
import { startIndexer } from './indexer/index.js';
import { authRoutes } from './middleware/auth.js';
import { profileRoutes } from './routes/profile.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { seasonRoutes } from './routes/seasons.js';
import { socialRoutes } from './routes/social.js';
import { sbtRoutes } from './routes/sbt.js';
import { statsRoutes } from './routes/stats.js';

// ── Build Fastify instance ────────────────────────────────────────────────────

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
  },
  trustProxy: true,
});

// ── Plugins ───────────────────────────────────────────────────────────────────

await fastify.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

await fastify.register(helmet, {
  contentSecurityPolicy: false, // relax for API
});

await fastify.register(jwt, {
  secret: config.jwt.secret,
  sign: {
    expiresIn: config.jwt.expiresIn,
  },
});

// ── Health check ──────────────────────────────────────────────────────────────

fastify.get('/health', async (request, reply) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 'ok' : 'degraded';

  return reply.status(dbOk ? 200 : 503).send({
    status,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'up' : 'down',
    },
    config: {
      chain: 'somnia',
      chainId: config.somnia.chainId,
      contracts: {
        scoreRegistry: config.contracts.scoreRegistry,
        marketAdapter: config.contracts.marketAdapter,
        seasonManager: config.contracts.seasonManager,
        mockMarket: config.contracts.mockMarket,
        sbt: config.contracts.sbt || 'not deployed',
        social: config.contracts.social || 'not deployed',
      },
    },
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────

await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
await fastify.register(profileRoutes, { prefix: '/api/v1/profile' });
await fastify.register(leaderboardRoutes, { prefix: '/api/v1/leaderboard' });
await fastify.register(seasonRoutes, { prefix: '/api/v1/seasons' });
await fastify.register(socialRoutes, { prefix: '/api/v1/social' });
await fastify.register(sbtRoutes, { prefix: '/api/v1/sbt' });
await fastify.register(statsRoutes, { prefix: '/api/v1/stats' });

// ── Error handler ─────────────────────────────────────────────────────────────

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation error',
      details: error.validation,
    });
  }

  if (error.statusCode) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  return reply.status(500).send({ error: 'Internal server error' });
});

// ── Not found handler ─────────────────────────────────────────────────────────

fastify.setNotFoundHandler((request, reply) => {
  return reply.status(404).send({
    error: `Route ${request.method} ${request.url} not found`,
  });
});

// ── Start server ──────────────────────────────────────────────────────────────

async function start() {
  try {
    // Build Fastify app (needed before wrapping in http.Server)
    await fastify.ready();

    // Create raw HTTP server from Fastify's underlying server
    const httpServer = fastify.server;

    // Attach Socket.io to the same HTTP server
    const io = setupWebSocket(httpServer);
    fastify.log.info('[WS] Socket.io attached to HTTP server');

    // Start the event indexer
    startIndexer(io);
    fastify.log.info('[Indexer] Event indexer started');

    // Start listening
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`[Server] Tyche backend listening on port ${config.port}`);

  } catch (err) {
    fastify.log.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal) {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
  try {
    await fastify.close();
    await pool.end();
    console.log('[Server] Shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('[Server] Shutdown error:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  // Don't exit — let graceful shutdown handle it
});
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

start();
