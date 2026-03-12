// src/indexer/index.js — Ethers.js v6 event indexer for all Tyche contracts

import { ethers } from 'ethers';
import config from '../config.js';
import { query } from '../db/index.js';
import {
  MockPredictionMarketABI,
  TycheScoreRegistryABI,
  TycheSocialABI,
  TycheSeasonManagerABI,
} from './abis.js';
import {
  emitScoreUpdated,
  emitTierChanged,
  emitSbtEvolved,
  emitLeaderboardReorder,
  emitFeedEvent,
  emitSeasonEnded,
  emitSeasonWarning,
} from '../websocket/index.js';
import { invalidateLeaderboard, invalidateProfile } from '../services/redis.js';

const TIER_NAMES = config.tiers;

// ── Provider + reconnect ───────────────────────────────────────────────────────

let provider = null;
let io = null;

function createProvider() {
  return new ethers.JsonRpcProvider(config.somnia.rpcUrl, {
    chainId: config.somnia.chainId,
    name: 'somnia',
  });
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function upsertWallet(address) {
  await query(
    `INSERT INTO wallets (address, created_at, updated_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT (address) DO UPDATE SET updated_at = NOW()`,
    [address.toLowerCase()]
  );
}

async function upsertScore(data) {
  const addr = data.wallet.toLowerCase();
  await upsertWallet(addr);
  await query(
    `INSERT INTO scores
       (address, accuracy_score, alpha_score, calibration_score, consistency_score,
        composite_score, tier, total_predictions, total_wins, total_pnl, last_update_block, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
     ON CONFLICT (address) DO UPDATE SET
       accuracy_score    = EXCLUDED.accuracy_score,
       alpha_score       = EXCLUDED.alpha_score,
       calibration_score = EXCLUDED.calibration_score,
       consistency_score = EXCLUDED.consistency_score,
       composite_score   = EXCLUDED.composite_score,
       tier              = EXCLUDED.tier,
       total_predictions = EXCLUDED.total_predictions,
       total_wins        = EXCLUDED.total_wins,
       total_pnl         = EXCLUDED.total_pnl,
       last_update_block = EXCLUDED.last_update_block,
       updated_at        = NOW()`,
    [
      addr,
      data.accuracyScore ?? 0,
      data.alphaScore ?? 0,
      data.calibrationScore ?? 0,
      data.consistencyScore ?? 0,
      data.compositeScore,
      data.tier,
      data.totalPredictions,
      data.totalWins,
      data.totalPnl,
      data.lastUpdateBlock,
    ]
  );
}

async function insertScoreHistory(wallet, compositeScore, tier, blockNumber) {
  await query(
    `INSERT INTO score_history (wallet, composite_score, tier, block_number, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [wallet.toLowerCase(), compositeScore, tier, blockNumber]
  );
}

async function getTopNCompositeScores(n = 100) {
  const res = await query(
    `SELECT address, composite_score FROM scores ORDER BY composite_score DESC LIMIT $1`,
    [n]
  );
  return res.rows;
}

async function insertFeedEvent(eventType, actorWallet, relatedWallet, marketId, metadata, blockNumber) {
  const res = await query(
    `INSERT INTO feed_events (event_type, actor_wallet, related_wallet, market_id, metadata, block_number, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING id`,
    [
      eventType,
      actorWallet ? actorWallet.toLowerCase() : null,
      relatedWallet ? relatedWallet.toLowerCase() : null,
      marketId || null,
      metadata ? JSON.stringify(metadata) : null,
      blockNumber || 0,
    ]
  );
  return res.rows[0];
}

// ── ScoreUpdated handler ──────────────────────────────────────────────────────

let lastTop100 = [];

async function handleScoreUpdated(wallet, compositeScore, tier, totalPredictions, totalWins, totalPnl, event) {
  const addr = wallet.toLowerCase();
  const blockNumber = event.log?.blockNumber ?? 0;

  console.log(`[Indexer] ScoreUpdated: ${addr} score=${compositeScore} tier=${tier}`);

  try {
    // Fetch full profile from chain to store component scores
    let profileData = {
      wallet: addr,
      compositeScore: compositeScore.toString(),
      tier: Number(tier),
      totalPredictions: Number(totalPredictions),
      totalWins: Number(totalWins),
      totalPnl: totalPnl.toString(),
      lastUpdateBlock: blockNumber,
      accuracyScore: 0,
      alphaScore: 0,
      calibrationScore: 0,
      consistencyScore: 0,
    };

    // Try to fetch full profile from contract
    try {
      const scoreRegistryContract = new ethers.Contract(
        config.contracts.scoreRegistry,
        TycheScoreRegistryABI,
        provider
      );
      const profile = await scoreRegistryContract.getProfile(wallet);
      profileData.accuracyScore = profile.accuracyScore.toString();
      profileData.alphaScore = profile.alphaScore.toString();
      profileData.calibrationScore = profile.calibrationScore.toString();
      profileData.consistencyScore = profile.consistencyScore.toString();
      profileData.lastUpdateBlock = Number(profile.lastUpdateBlock) || blockNumber;
    } catch (err) {
      console.warn(`[Indexer] Could not fetch full profile for ${addr}:`, err.message);
    }

    await upsertScore(profileData);
    await insertScoreHistory(addr, compositeScore.toString(), Number(tier), blockNumber);

    // Invalidate caches
    await invalidateProfile(addr);

    // Check if top 100 has changed
    const newTop100 = await getTopNCompositeScores(100);
    const changed = JSON.stringify(newTop100) !== JSON.stringify(lastTop100);
    lastTop100 = newTop100;

    if (changed && io) {
      await invalidateLeaderboard();
      emitLeaderboardReorder(io, { top100: newTop100.slice(0, 10) });
    }

    if (io) {
      emitScoreUpdated(io, addr, {
        wallet: addr,
        compositeScore: compositeScore.toString(),
        tier: Number(tier),
        tierName: TIER_NAMES[Number(tier)] || 'Bronze',
        totalPredictions: Number(totalPredictions),
        totalWins: Number(totalWins),
        totalPnl: totalPnl.toString(),
      });
    }
  } catch (err) {
    console.error('[Indexer] handleScoreUpdated error:', err.message);
  }
}

// ── TierChanged handler ───────────────────────────────────────────────────────

async function handleTierChanged(wallet, oldTier, newTier, event) {
  const addr = wallet.toLowerCase();
  const blockNumber = event.log?.blockNumber ?? 0;

  console.log(`[Indexer] TierChanged: ${addr} ${oldTier} → ${newTier}`);

  try {
    await insertFeedEvent(
      'tier_changed',
      addr,
      null,
      null,
      {
        oldTier: Number(oldTier),
        oldTierName: TIER_NAMES[Number(oldTier)] || 'Bronze',
        newTier: Number(newTier),
        newTierName: TIER_NAMES[Number(newTier)] || 'Bronze',
      },
      blockNumber
    );

    if (io) {
      emitTierChanged(io, addr, {
        wallet: addr,
        oldTier: Number(oldTier),
        oldTierName: TIER_NAMES[Number(oldTier)] || 'Bronze',
        newTier: Number(newTier),
        newTierName: TIER_NAMES[Number(newTier)] || 'Bronze',
      });
    }
  } catch (err) {
    console.error('[Indexer] handleTierChanged error:', err.message);
  }
}

// ── SBTMinted handler ─────────────────────────────────────────────────────────

async function handleSBTMinted(wallet, tier, event) {
  const addr = wallet.toLowerCase();
  const blockNumber = event.log?.blockNumber ?? 0;

  console.log(`[Indexer] SBTMinted: ${addr} tier=${tier}`);

  try {
    // Update sbt_minted in scores — note: no direct sbtMinted column, tracked via badges
    await query(
      `INSERT INTO badges (wallet, season_id, badge_type, metadata, earned_at)
       SELECT $1, NULL, 'sbt_minted', $2, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM badges WHERE wallet=$1 AND badge_type='sbt_minted' AND season_id IS NULL
       )`,
      [addr, JSON.stringify({ tier: Number(tier), tierName: TIER_NAMES[Number(tier)] || 'Bronze' })]
    );

    await insertFeedEvent('sbt_minted', addr, null, null, { tier: Number(tier) }, blockNumber);

    if (io) {
      emitSbtEvolved(io, addr, {
        wallet: addr,
        tier: Number(tier),
        tierName: TIER_NAMES[Number(tier)] || 'Bronze',
      });
    }
  } catch (err) {
    console.error('[Indexer] handleSBTMinted error:', err.message);
  }
}

// ── BetPlaced handler ─────────────────────────────────────────────────────────

async function handleBetPlaced(marketId, wallet, position, entryOdds, amount, event) {
  const addr = wallet.toLowerCase();
  const mId = marketId.toString();
  const blockNumber = event.log?.blockNumber ?? 0;

  console.log(`[Indexer] BetPlaced: market=${mId} wallet=${addr}`);

  try {
    await upsertWallet(addr);

    // Get market category if available
    let category = null;
    try {
      const res = await query('SELECT category FROM markets WHERE market_id = $1', [mId]);
      if (res.rows.length > 0) category = res.rows[0].category;
    } catch {
      // ignore
    }

    await query(
      `INSERT INTO predictions
         (market_id, wallet, category, platform, position, entry_odds, amount, result, block_number, created_at)
       VALUES ($1,$2,$3,'mock',$4,$5,$6,'PENDING',$7,NOW())`,
      [mId, addr, category, position, entryOdds.toString(), amount.toString(), blockNumber]
    );
  } catch (err) {
    console.error('[Indexer] handleBetPlaced error:', err.message);
  }
}

// ── BetSettled handler ────────────────────────────────────────────────────────

async function handleBetSettled(marketId, wallet, won, pnl, event) {
  const addr = wallet.toLowerCase();
  const mId = marketId.toString();
  const blockNumber = event.log?.blockNumber ?? 0;

  console.log(`[Indexer] BetSettled: market=${mId} wallet=${addr} won=${won}`);

  try {
    await query(
      `UPDATE predictions
       SET result = $1, pnl = $2, exit_odds = $3, settled_at = NOW()
       WHERE id = (
         SELECT id FROM predictions
         WHERE market_id = $4 AND wallet = $5 AND result = 'PENDING'
         ORDER BY created_at DESC
         LIMIT 1
       )`,
      [won ? 'WIN' : 'LOSS', pnl.toString(), won ? 9500 : 500, mId, addr]
    );
  } catch (err) {
    console.error('[Indexer] handleBetSettled error:', err.message);
  }
}

// ── MarketCreated handler ─────────────────────────────────────────────────────

async function handleMarketCreated(marketId, title, category, event) {
  const mId = marketId.toString();
  const blockNumber = event.log?.blockNumber ?? 0;

  console.log(`[Indexer] MarketCreated: ${mId} "${title}"`);

  try {
    await query(
      `INSERT INTO markets (market_id, title, category, platform, resolved, block_number, created_at)
       VALUES ($1,$2,$3,'mock',FALSE,$4,NOW())
       ON CONFLICT (market_id) DO UPDATE SET title=EXCLUDED.title, category=EXCLUDED.category`,
      [mId, title, category, blockNumber]
    );
  } catch (err) {
    console.error('[Indexer] handleMarketCreated error:', err.message);
  }
}

// ── MarketResolved handler ────────────────────────────────────────────────────

async function handleMarketResolved(marketId, outcome, event) {
  const mId = marketId.toString();

  console.log(`[Indexer] MarketResolved: ${mId} outcome=${outcome}`);

  try {
    await query(
      `UPDATE markets SET resolved=TRUE, outcome=$1, resolved_at=NOW() WHERE market_id=$2`,
      [outcome, mId]
    );
  } catch (err) {
    console.error('[Indexer] handleMarketResolved error:', err.message);
  }
}

// ── FollowCreated handler ─────────────────────────────────────────────────────

async function handleFollowCreated(follower, target, event) {
  const f = follower.toLowerCase();
  const t = target.toLowerCase();
  const blockNumber = event.log?.blockNumber ?? 0;

  console.log(`[Indexer] FollowCreated: ${f} → ${t}`);

  try {
    await upsertWallet(f);
    await upsertWallet(t);

    await query(
      `INSERT INTO social_follows (follower, target, created_at, block_number)
       VALUES ($1,$2,NOW(),$3)
       ON CONFLICT (follower, target) DO NOTHING`,
      [f, t, blockNumber]
    );

    await insertFeedEvent('follow', f, t, null, null, blockNumber);

    // Notify the target's feed
    if (io) {
      emitFeedEvent(io, t, { type: 'follow', follower: f, target: t });
    }
  } catch (err) {
    console.error('[Indexer] handleFollowCreated error:', err.message);
  }
}

// ── FollowRemoved handler ─────────────────────────────────────────────────────

async function handleFollowRemoved(follower, target, event) {
  const f = follower.toLowerCase();
  const t = target.toLowerCase();

  console.log(`[Indexer] FollowRemoved: ${f} → ${t}`);

  try {
    await query(
      `DELETE FROM social_follows WHERE follower=$1 AND target=$2`,
      [f, t]
    );
  } catch (err) {
    console.error('[Indexer] handleFollowRemoved error:', err.message);
  }
}

// ── SeasonStarted handler ─────────────────────────────────────────────────────

async function handleSeasonStarted(seasonId, startBlock, endBlock, event) {
  const sId = Number(seasonId);

  console.log(`[Indexer] SeasonStarted: season=${sId}`);

  try {
    await query(
      `INSERT INTO seasons (id, start_block, end_block, finalized, created_at)
       VALUES ($1,$2,$3,FALSE,NOW())
       ON CONFLICT (id) DO UPDATE SET start_block=EXCLUDED.start_block, end_block=EXCLUDED.end_block`,
      [sId, Number(startBlock), Number(endBlock)]
    );
  } catch (err) {
    console.error('[Indexer] handleSeasonStarted error:', err.message);
  }
}

// ── SeasonFinalized handler ───────────────────────────────────────────────────

async function handleSeasonFinalized(seasonId, topPredictors, event) {
  const sId = Number(seasonId);

  console.log(`[Indexer] SeasonFinalized: season=${sId}`);

  try {
    // Fetch scores for each top predictor
    const topScores = [];
    for (const addr of topPredictors) {
      if (addr === ethers.ZeroAddress) {
        topScores.push(0);
        continue;
      }
      const res = await query(
        'SELECT composite_score FROM scores WHERE address=$1',
        [addr.toLowerCase()]
      );
      topScores.push(res.rows[0]?.composite_score ?? 0);
    }

    await query(
      `UPDATE seasons
       SET finalized=TRUE, top_predictors=$1, top_scores=$2, finalized_at=NOW()
       WHERE id=$3`,
      [
        JSON.stringify(topPredictors),
        JSON.stringify(topScores),
        sId,
      ]
    );

    // Award badges to top predictors
    const badgeTypes = ['season_1st', 'season_2nd', 'season_3rd'];
    for (let i = 0; i < Math.min(3, topPredictors.length); i++) {
      const addr = topPredictors[i];
      if (!addr || addr === ethers.ZeroAddress) continue;

      const bType = badgeTypes[i] || `season_top_${i + 1}`;
      await query(
        `INSERT INTO badges (wallet, season_id, badge_type, metadata, earned_at)
         SELECT $1,$2,$3,$4,NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM badges WHERE wallet=$1 AND season_id=$2 AND badge_type=$3
         )`,
        [
          addr.toLowerCase(),
          sId,
          bType,
          JSON.stringify({ rank: i + 1, season: sId, score: topScores[i] }),
        ]
      );
    }

    // Award top-10 badge to all in list
    for (let i = 3; i < topPredictors.length; i++) {
      const addr = topPredictors[i];
      if (!addr || addr === ethers.ZeroAddress) continue;

      await query(
        `INSERT INTO badges (wallet, season_id, badge_type, metadata, earned_at)
         SELECT $1,$2,'season_top10',$3,NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM badges WHERE wallet=$1 AND season_id=$2 AND badge_type='season_top10'
         )`,
        [
          addr.toLowerCase(),
          sId,
          JSON.stringify({ rank: i + 1, season: sId, score: topScores[i] }),
        ]
      );
    }

    if (io) {
      emitSeasonEnded(io, {
        seasonId: sId,
        topPredictors,
        topScores,
      });
    }
  } catch (err) {
    console.error('[Indexer] handleSeasonFinalized error:', err.message);
  }
}

// ── Contract listener setup ───────────────────────────────────────────────────

function attachMockMarketListeners(contract) {
  contract.on('MarketCreated', handleMarketCreated);
  contract.on('BetPlaced', handleBetPlaced);
  contract.on('MarketResolved', handleMarketResolved);
  contract.on('BetSettled', handleBetSettled);
  console.log('[Indexer] MockPredictionMarket listeners attached');
}

function attachScoreRegistryListeners(contract) {
  contract.on('ScoreUpdated', handleScoreUpdated);
  contract.on('TierChanged', handleTierChanged);
  contract.on('SBTMinted', handleSBTMinted);
  console.log('[Indexer] TycheScoreRegistry listeners attached');
}

function attachSocialListeners(contract) {
  contract.on('FollowCreated', handleFollowCreated);
  contract.on('FollowRemoved', handleFollowRemoved);
  console.log('[Indexer] TycheSocial listeners attached');
}

function attachSeasonManagerListeners(contract) {
  contract.on('SeasonStarted', handleSeasonStarted);
  contract.on('SeasonFinalized', handleSeasonFinalized);
  console.log('[Indexer] TycheSeasonManager listeners attached');
}

// ── Reconnect logic ───────────────────────────────────────────────────────────

let reconnectTimer = null;
const RECONNECT_DELAY_MS = 5000;

function scheduleReconnect() {
  if (reconnectTimer) return;
  console.log(`[Indexer] Scheduling reconnect in ${RECONNECT_DELAY_MS}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startListeners();
  }, RECONNECT_DELAY_MS);
}

function startListeners() {
  console.log('[Indexer] Connecting to Somnia RPC:', config.somnia.rpcUrl);

  try {
    provider = createProvider();

    provider.on('error', (err) => {
      console.error('[Indexer] Provider error:', err.message);
      scheduleReconnect();
    });

    // MockPredictionMarket
    const mockMarket = new ethers.Contract(
      config.contracts.mockMarket,
      MockPredictionMarketABI,
      provider
    );
    attachMockMarketListeners(mockMarket);

    // TycheScoreRegistry
    const scoreRegistry = new ethers.Contract(
      config.contracts.scoreRegistry,
      TycheScoreRegistryABI,
      provider
    );
    attachScoreRegistryListeners(scoreRegistry);

    // TycheSeasonManager
    const seasonManager = new ethers.Contract(
      config.contracts.seasonManager,
      TycheSeasonManagerABI,
      provider
    );
    attachSeasonManagerListeners(seasonManager);

    // TycheSocial — only if address is configured
    if (config.contracts.social && config.contracts.social !== '') {
      const social = new ethers.Contract(
        config.contracts.social,
        TycheSocialABI,
        provider
      );
      attachSocialListeners(social);
    } else {
      console.log('[Indexer] TycheSocial address not configured — skipping');
    }

    console.log('[Indexer] All listeners active');
  } catch (err) {
    console.error('[Indexer] Failed to start listeners:', err.message);
    scheduleReconnect();
  }
}

/**
 * Start the event indexer.
 * @param {import('socket.io').Server} socketIo - Socket.io instance for real-time emits
 */
export function startIndexer(socketIo) {
  io = socketIo;
  startListeners();
  console.log('[Indexer] Started');
}
