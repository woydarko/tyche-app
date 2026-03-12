// src/routes/sbt.js — SBT (Soulbound Token) routes (BE-07)

import { ethers } from 'ethers';
import { query } from '../db/index.js';
import config from '../config.js';

const TIER_NAMES = config.tiers;

// Tier colour palette for SVG generation
const TIER_COLOURS = {
  0: { bg: '#CD7F32', accent: '#E8A95A', name: 'Bronze' },    // Bronze
  1: { bg: '#C0C0C0', accent: '#E8E8E8', name: 'Silver' },    // Silver
  2: { bg: '#FFD700', accent: '#FFF176', name: 'Gold' },      // Gold
  3: { bg: '#00B4D8', accent: '#90E0EF', name: 'Platinum' }, // Platinum
  4: { bg: '#7B2FBE', accent: '#C77DFF', name: 'Oracle' },   // Oracle
};

/**
 * Generate an SVG image for a given tier.
 */
function generateTierSVG(tier, address = '') {
  const t = Math.min(4, Math.max(0, Number(tier)));
  const c = TIER_COLOURS[t];
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c.bg};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${c.accent};stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="400" height="400" rx="20" fill="url(#bg)" />
  <rect width="380" height="380" rx="16" x="10" y="10" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>

  <!-- Shield shape -->
  <path d="M200 60 L280 100 L280 200 Q280 270 200 310 Q120 270 120 200 L120 100 Z"
        fill="rgba(0,0,0,0.2)" stroke="rgba(255,255,255,0.5)" stroke-width="2" filter="url(#glow)"/>

  <!-- Tier symbol (T letter) -->
  <text x="200" y="205" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-size="80" font-weight="bold"
        fill="rgba(255,255,255,0.9)" filter="url(#glow)">T</text>

  <!-- Stars decoration -->
  <text x="200" y="260" text-anchor="middle" font-size="24" fill="rgba(255,255,255,0.8)">
    ${'★'.repeat(t + 1)}${'☆'.repeat(4 - t)}
  </text>

  <!-- Tier name -->
  <text x="200" y="330" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="28" font-weight="bold" fill="white" letter-spacing="4">
    ${c.name.toUpperCase()}
  </text>

  <!-- Protocol name -->
  <text x="200" y="365" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="14" fill="rgba(255,255,255,0.7)" letter-spacing="2">
    TYCHE • PREDICTION IDENTITY
  </text>

  ${shortAddr ? `<text x="200" y="50" text-anchor="middle" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.6)">${shortAddr}</text>` : ''}
</svg>`;
}

// Minimal SBT ABI for token queries
const SBT_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenOfOwner(address owner) view returns (uint256)',
  'function tierOf(uint256 tokenId) view returns (uint8)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

async function getSBTContract() {
  if (!config.contracts.sbt || config.contracts.sbt === '') {
    return null;
  }
  const provider = new ethers.JsonRpcProvider(config.somnia.rpcUrl, {
    chainId: config.somnia.chainId,
    name: 'somnia',
  });
  return new ethers.Contract(config.contracts.sbt, SBT_ABI, provider);
}

/**
 * GET /api/v1/sbt/:tokenId
 */
async function getSBTById(request, reply) {
  const { tokenId } = request.params;

  const contract = await getSBTContract();
  if (!contract) {
    return reply.status(503).send({ error: 'SBT contract not yet deployed' });
  }

  try {
    const [owner, tier] = await Promise.all([
      contract.ownerOf(tokenId),
      contract.tierOf(tokenId).catch(() => 0),
    ]);

    const tierNum = Number(tier);

    // Get DB profile
    const profileRes = await query(
      `SELECT s.composite_score, s.total_predictions, s.total_wins, w.ens_name
       FROM scores s JOIN wallets w ON s.address = w.address
       WHERE s.address = $1`,
      [owner.toLowerCase()]
    );

    const profile = profileRes.rows[0];

    return reply.send({
      data: {
        tokenId: Number(tokenId),
        owner: owner.toLowerCase(),
        tier: tierNum,
        tierName: TIER_NAMES[tierNum] || 'Bronze',
        ensName: profile?.ens_name || null,
        compositeScore: profile ? Number(profile.composite_score) : 0,
        totalPredictions: profile ? Number(profile.total_predictions) : 0,
        totalWins: profile ? Number(profile.total_wins) : 0,
        imageUrl: `/api/v1/sbt/${tokenId}/image`,
      },
    });
  } catch (err) {
    if (err.message?.includes('nonexistent token') || err.message?.includes('invalid token')) {
      return reply.status(404).send({ error: 'Token not found' });
    }
    console.error('[SBT] getSBTById error:', err.message);
    return reply.status(500).send({ error: 'Contract call failed' });
  }
}

/**
 * GET /api/v1/sbt/owner/:address
 */
async function getSBTByOwner(request, reply) {
  const { address } = request.params;

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return reply.status(400).send({ error: 'Invalid address' });
  }

  const contract = await getSBTContract();
  if (!contract) {
    // Fallback to DB data when contract not deployed
    const res = await query(
      `SELECT s.tier, s.composite_score, w.ens_name
       FROM scores s JOIN wallets w ON s.address = w.address
       WHERE s.address = $1`,
      [address.toLowerCase()]
    );

    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Wallet not found in registry' });
    }

    const r = res.rows[0];
    const tier = Number(r.tier ?? 0);

    return reply.send({
      data: {
        owner: address.toLowerCase(),
        tokenId: null,
        tier,
        tierName: TIER_NAMES[tier] || 'Bronze',
        ensName: r.ens_name || null,
        compositeScore: Number(r.composite_score ?? 0),
        sbtDeployed: false,
        imageUrl: `/api/v1/sbt/owner/${address}/image`,
      },
    });
  }

  try {
    const tokenId = await contract.tokenOfOwner(address);
    const tier = await contract.tierOf(tokenId).catch(() => 0);
    const tierNum = Number(tier);

    return reply.send({
      data: {
        owner: address.toLowerCase(),
        tokenId: Number(tokenId),
        tier: tierNum,
        tierName: TIER_NAMES[tierNum] || 'Bronze',
        imageUrl: `/api/v1/sbt/${tokenId}/image`,
        sbtDeployed: true,
      },
    });
  } catch (err) {
    if (err.message?.includes('no token') || err.message?.includes('not minted')) {
      return reply.status(404).send({ error: 'No SBT minted for this address' });
    }
    console.error('[SBT] getSBTByOwner error:', err.message);
    return reply.status(500).send({ error: 'Contract call failed' });
  }
}

/**
 * GET /api/v1/sbt/:tokenId/image
 * Returns the tier SVG inline.
 */
async function getSBTImage(request, reply) {
  const { tokenId } = request.params;

  let tier = 0;
  let ownerAddress = '';

  const contract = await getSBTContract();
  if (contract) {
    try {
      const [owner, t] = await Promise.all([
        contract.ownerOf(tokenId).catch(() => null),
        contract.tierOf(tokenId).catch(() => 0),
      ]);
      tier = Number(t);
      ownerAddress = owner || '';
    } catch {
      // use defaults
    }
  } else {
    // Try to infer from tokenId = wallet lookup (no SBT contract yet)
    // tokenId is used as a placeholder — return a default bronze SVG
    tier = 0;
  }

  const svg = generateTierSVG(tier, ownerAddress);

  return reply
    .header('Content-Type', 'image/svg+xml')
    .header('Cache-Control', 'public, max-age=300')
    .send(svg);
}

/**
 * Register SBT routes.
 */
export async function sbtRoutes(fastify, options) {
  fastify.get('/owner/:address', getSBTByOwner);
  fastify.get('/:tokenId/image', getSBTImage);
  fastify.get('/:tokenId', getSBTById);
}
