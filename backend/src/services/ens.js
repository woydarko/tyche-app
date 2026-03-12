// src/services/ens.js — ENS name resolution via Ethereum mainnet

import { ethers } from 'ethers';
import config from '../config.js';
import { cacheGet, cacheSet } from './redis.js';

let provider = null;

function getProvider() {
  if (!provider) {
    try {
      provider = new ethers.JsonRpcProvider(config.eth.mainnetRpc);
    } catch (err) {
      console.warn('[ENS] Failed to create provider:', err.message);
      return null;
    }
  }
  return provider;
}

const ENS_CACHE_TTL = 86400; // 24 hours in seconds

/**
 * Resolve an Ethereum address to its ENS name.
 * Returns null if no ENS name is found or on error.
 * Results are cached in Redis for 24h.
 *
 * @param {string} address - Ethereum address (checksummed or lowercase)
 * @returns {Promise<string|null>} ENS name or null
 */
export async function resolveENS(address) {
  if (!address) return null;

  const normalised = address.toLowerCase();
  const cacheKey = `tyche:ens:${normalised}`;

  // Check Redis cache first
  try {
    const cached = await cacheGet(cacheKey);
    if (cached !== null) {
      return cached === '' ? null : cached;
    }
  } catch {
    // proceed without cache
  }

  const p = getProvider();
  if (!p) return null;

  try {
    const name = await p.lookupAddress(address);
    // Cache result (empty string means "no ENS name" to distinguish from cache miss)
    await cacheSet(cacheKey, name || '', ENS_CACHE_TTL);
    return name || null;
  } catch (err) {
    // ENS lookup failed — cache null result briefly to avoid hammering
    await cacheSet(cacheKey, '', 300);
    return null;
  }
}

/**
 * Resolve ENS name to address (reverse lookup).
 * @param {string} ensName - ENS name like 'vitalik.eth'
 * @returns {Promise<string|null>} address or null
 */
export async function resolveAddress(ensName) {
  if (!ensName) return null;

  const cacheKey = `tyche:ens:name:${ensName.toLowerCase()}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached !== null) {
      return cached === '' ? null : cached;
    }
  } catch {
    // proceed without cache
  }

  const p = getProvider();
  if (!p) return null;

  try {
    const address = await p.resolveName(ensName);
    await cacheSet(cacheKey, address || '', ENS_CACHE_TTL);
    return address || null;
  } catch {
    await cacheSet(cacheKey, '', 300);
    return null;
  }
}
