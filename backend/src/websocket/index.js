// src/websocket/index.js — Socket.io server setup

import { Server } from 'socket.io';

/**
 * Set up the Socket.io server attached to an existing HTTP server.
 *
 * Room conventions:
 *   wallet:<address>        — per-wallet updates (score, tier, sbt)
 *   leaderboard             — global leaderboard reorders
 *   feed:<address>          — social feed for a wallet
 *   season                  — season lifecycle events
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server} io instance
 */
export function setupWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // ── Room subscriptions ─────────────────────────────────────────────────

    socket.on('subscribe:wallet', (address) => {
      if (!address || typeof address !== 'string') return;
      const room = `wallet:${address.toLowerCase()}`;
      socket.join(room);
      console.log(`[WS] ${socket.id} subscribed to ${room}`);
    });

    socket.on('unsubscribe:wallet', (address) => {
      if (!address || typeof address !== 'string') return;
      const room = `wallet:${address.toLowerCase()}`;
      socket.leave(room);
    });

    socket.on('subscribe:leaderboard', () => {
      socket.join('leaderboard');
      console.log(`[WS] ${socket.id} subscribed to leaderboard`);
    });

    socket.on('unsubscribe:leaderboard', () => {
      socket.leave('leaderboard');
    });

    socket.on('subscribe:feed', (address) => {
      if (!address || typeof address !== 'string') return;
      const room = `feed:${address.toLowerCase()}`;
      socket.join(room);
    });

    socket.on('unsubscribe:feed', (address) => {
      if (!address || typeof address !== 'string') return;
      const room = `feed:${address.toLowerCase()}`;
      socket.leave(room);
    });

    socket.on('subscribe:season', () => {
      socket.join('season');
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

// ─── Emit helpers (called from indexer) ──────────────────────────────────────

/**
 * Emit a score:updated event to the wallet room.
 * @param {import('socket.io').Server} io
 * @param {string} wallet
 * @param {object} data
 */
export function emitScoreUpdated(io, wallet, data) {
  io.to(`wallet:${wallet.toLowerCase()}`).emit('score:updated', data);
}

/**
 * Emit a tier:changed event to the wallet room.
 */
export function emitTierChanged(io, wallet, data) {
  io.to(`wallet:${wallet.toLowerCase()}`).emit('tier:changed', data);
}

/**
 * Emit an sbt:evolved event to the wallet room.
 */
export function emitSbtEvolved(io, wallet, data) {
  io.to(`wallet:${wallet.toLowerCase()}`).emit('sbt:evolved', data);
}

/**
 * Emit a leaderboard:reorder event to all leaderboard subscribers.
 */
export function emitLeaderboardReorder(io, data) {
  io.to('leaderboard').emit('leaderboard:reorder', data);
}

/**
 * Emit a feed:event to a specific wallet's feed room.
 */
export function emitFeedEvent(io, wallet, data) {
  io.to(`feed:${wallet.toLowerCase()}`).emit('feed:event', data);
}

/**
 * Emit a season:warning event (season ending soon).
 */
export function emitSeasonWarning(io, data) {
  io.to('season').emit('season:warning', data);
}

/**
 * Emit a season:ended event.
 */
export function emitSeasonEnded(io, data) {
  io.to('season').emit('season:ended', data);
}
