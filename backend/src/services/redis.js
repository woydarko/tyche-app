// src/services/redis.js — Redis client + cache helpers

import Redis from 'ioredis';
import config from '../config.js';

let client = null;
let isConnected = false;

function createClient() {
  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 5) return null; // stop retrying
      return Math.min(times * 200, 2000);
    },
  });

  redis.on('connect', () => {
    isConnected = true;
    console.log('[Redis] Connected');
  });

  redis.on('error', (err) => {
    if (isConnected) {
      console.warn('[Redis] Connection error:', err.message);
    }
    isConnected = false;
  });

  redis.on('close', () => {
    isConnected = false;
  });

  return redis;
}

export function getRedisClient() {
  if (!client) {
    client = createClient();
    client.connect().catch((err) => {
      console.warn('[Redis] Initial connection failed (continuing without cache):', err.message);
    });
  }
  return client;
}

// ─── Leaderboard cache ────────────────────────────────────────────────────────

const LEADERBOARD_KEY = 'tyche:leaderboard:global';

export async function getCachedLeaderboard() {
  if (!isConnected) return null;
  try {
    const data = await client.get(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setCachedLeaderboard(data, ttl = 30) {
  if (!isConnected) return;
  try {
    await client.setex(LEADERBOARD_KEY, ttl, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function invalidateLeaderboard() {
  if (!isConnected) return;
  try {
    await client.del(LEADERBOARD_KEY);
  } catch {
    // ignore
  }
}

// ─── Profile cache ────────────────────────────────────────────────────────────

function profileKey(address) {
  return `tyche:profile:${address.toLowerCase()}`;
}

export async function getCachedProfile(address) {
  if (!isConnected) return null;
  try {
    const data = await client.get(profileKey(address));
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setCachedProfile(address, data, ttl = 60) {
  if (!isConnected) return;
  try {
    await client.setex(profileKey(address), ttl, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function invalidateProfile(address) {
  if (!isConnected) return;
  try {
    await client.del(profileKey(address));
  } catch {
    // ignore
  }
}

// ─── Generic cache helpers ────────────────────────────────────────────────────

export async function cacheGet(key) {
  if (!isConnected) return null;
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, data, ttl = 60) {
  if (!isConnected) return;
  try {
    await client.setex(key, ttl, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function cacheDel(key) {
  if (!isConnected) return;
  try {
    await client.del(key);
  } catch {
    // ignore
  }
}

// Initialise client on module load
getRedisClient();
