// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./base/ReactiveBase.sol";
import "./TycheScoreRegistry.sol";

/**
 * @title TycheSeasonManager
 * @notice Manages Tyche prediction season lifecycle and leaderboard tracking.
 *
 *         Seasons are discrete competition periods (defined by block range).
 *         At season end, the top 10 predictors by composite score are snapshotted.
 *
 *         SECOND KEY SOMNIA REACTIVITY FEATURE — CRON:
 *         ─────────────────────────────────────────────────────────────────────
 *         Uses Somnia Reactivity CRON to trigger every 1000 blocks:
 *           1. Apply 2% score decay to inactive wallets
 *           2. Check if current season should auto-finalize
 *         ─────────────────────────────────────────────────────────────────────
 *
 * @dev SC-09 (season lifecycle) + SC-10 (cron decay)
 *      Tyche | Somnia Reactivity Mini Hackathon 2026
 */
contract TycheSeasonManager is Ownable, ReactiveBase {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Season {
        uint256 id;
        uint256 startBlock;
        uint256 endBlock;
        address[10] topPredictors;   // top 10 wallets by composite score at finalization
        uint256[10] topScores;       // their composite scores
        bool    finalized;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event SeasonStarted(uint256 indexed seasonId, uint256 startBlock, uint256 endBlock);
    event SeasonFinalized(uint256 indexed seasonId, address[10] topPredictors);
    event DecayApplied(uint256 epochBlock, uint256 walletsDecayed);

    // ─── Somnia Reactivity CRON subscription signal ───────────────────────────
    /**
     * @notice Emitted in constructor to register a periodic CRON callback.
     *         Somnia Reactivity runtime will call react() every `interval` blocks.
     *
     * @param service   Reactive service address
     * @param interval  Block interval for the cron (1000 blocks ≈ every ~16 min)
     * @param gasLimit  Gas budget for each cron callback
     */
    event CronSubscribed(address indexed service, uint256 interval, uint256 gasLimit);

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant DECAY_INTERVAL  = 1000;   // blocks between decay runs
    uint256 public constant SEASON_DURATION = 50_000; // blocks per season (~8 days)
    uint256 public constant TOP_N           = 10;     // top predictors tracked

    // CRON opCode from Somnia Reactivity SDK
    uint256 public constant OPCODE_CRON = 1;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    TycheScoreRegistry public scoreRegistry;

    uint256 public currentSeasonId;
    mapping(uint256 => Season) public seasons;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _reactiveService  Somnia Reactivity service address
     * @param _scoreRegistry    TycheScoreRegistry contract
     */
    constructor(
        address _reactiveService,
        address _scoreRegistry
    )
        Ownable(msg.sender)
        ReactiveBase(_reactiveService)
    {
        scoreRegistry = TycheScoreRegistry(_scoreRegistry);

        // ─── SOMNIA REACTIVITY CRON SUBSCRIPTION ──────────────────────────
        // Subscribe to a periodic CRON callback every DECAY_INTERVAL blocks.
        // Somnia's reactive runtime will call react() with opCode=OPCODE_CRON
        // on this schedule automatically — no keeper or manual trigger needed.
        emit CronSubscribed(_reactiveService, DECAY_INTERVAL, 2_000_000);
    }

    // -------------------------------------------------------------------------
    // Season lifecycle
    // -------------------------------------------------------------------------

    /**
     * @notice Start a new season.
     * @param durationBlocks Duration in blocks (default SEASON_DURATION if 0)
     */
    function startSeason(uint256 durationBlocks) external onlyOwner {
        // Finalize current season if one is running and not finalized
        if (currentSeasonId > 0) {
            Season storage current = seasons[currentSeasonId];
            require(
                current.finalized || block.number >= current.endBlock,
                "TycheSeasonManager: current season still active"
            );
            if (!current.finalized) {
                _finalizeSeason(currentSeasonId);
            }
        }

        uint256 duration = durationBlocks == 0 ? SEASON_DURATION : durationBlocks;
        currentSeasonId += 1;

        Season storage s = seasons[currentSeasonId];
        s.id         = currentSeasonId;
        s.startBlock = block.number;
        s.endBlock   = block.number + duration;
        s.finalized  = false;

        emit SeasonStarted(currentSeasonId, s.startBlock, s.endBlock);
    }

    /**
     * @notice Manually finalize the current season (owner or auto via cron).
     */
    function endSeason() external {
        require(
            msg.sender == owner() || msg.sender == reactiveService,
            "TycheSeasonManager: unauthorized"
        );
        require(currentSeasonId > 0, "TycheSeasonManager: no active season");

        Season storage s = seasons[currentSeasonId];
        require(!s.finalized, "TycheSeasonManager: already finalized");
        require(block.number >= s.endBlock, "TycheSeasonManager: season not ended");

        _finalizeSeason(currentSeasonId);
    }

    /**
     * @notice Get the top predictors for a given season.
     */
    function getTopPredictors(uint256 seasonId)
        external
        view
        returns (address[10] memory wallets, uint256[10] memory scores)
    {
        Season storage s = seasons[seasonId];
        return (s.topPredictors, s.topScores);
    }

    /**
     * @notice Get current season info.
     */
    function getCurrentSeason() external view returns (Season memory) {
        return seasons[currentSeasonId];
    }

    // -------------------------------------------------------------------------
    // Somnia Reactivity — CRON callback handler
    // -------------------------------------------------------------------------

    /**
     * @notice Called by Somnia Reactivity runtime every DECAY_INTERVAL blocks.
     *         opCode == OPCODE_CRON indicates a scheduled tick.
     *
     *         On each tick:
     *           1. Apply 2% score decay to all inactive wallets
     *           2. Auto-finalize season if endBlock has passed
     */
    function _onReact(
        uint256 /* chainId */,
        address /* _contract */,
        uint256 /* topic0 */,
        uint256 /* topic1 */,
        uint256 /* topic2 */,
        uint256 /* topic3 */,
        bytes calldata /* data */,
        uint256 /* blockNumber */,
        uint256 opCode
    ) internal override {
        if (opCode != OPCODE_CRON) return;

        // ── 1. Apply decay to all inactive wallets ──────────────────────────
        uint256 count = scoreRegistry.getPredictorCount();
        uint256 decayed = 0;

        // Process up to 50 wallets per cron tick to stay within gas limits
        // (remaining wallets handled in subsequent ticks)
        uint256 limit = count < 50 ? count : 50;
        uint256 offset = block.number % (count == 0 ? 1 : count); // rotating window
        if (offset + limit > count) offset = 0;

        address[] memory batch = scoreRegistry.getPredictors(offset, limit);
        for (uint256 i = 0; i < batch.length; i++) {
            if (batch[i] == address(0)) continue;
            try scoreRegistry.applyDecay(batch[i]) {
                decayed++;
            } catch {
                // skip failed wallets, don't revert the whole cron
            }
        }

        emit DecayApplied(block.number, decayed);

        // ── 2. Auto-finalize season if time is up ──────────────────────────
        if (currentSeasonId > 0) {
            Season storage s = seasons[currentSeasonId];
            if (!s.finalized && block.number >= s.endBlock) {
                _finalizeSeason(currentSeasonId);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /**
     * @notice Snapshot top 10 predictors by composite score and mark season done.
     */
    function _finalizeSeason(uint256 seasonId) internal {
        Season storage s = seasons[seasonId];

        uint256 count = scoreRegistry.getPredictorCount();
        address[] memory all = scoreRegistry.getPredictors(0, count);

        // Simple insertion sort into top-10 (acceptable for ≤ few thousand wallets)
        address[10] memory topW;
        uint256[10] memory topS;

        for (uint256 i = 0; i < all.length; i++) {
            address w = all[i];
            uint256 sc = scoreRegistry.getCompositeScore(w);

            // Find insertion point
            for (uint256 j = 0; j < TOP_N; j++) {
                if (sc > topS[j]) {
                    // Shift down
                    for (uint256 k = TOP_N - 1; k > j; k--) {
                        topW[k] = topW[k - 1];
                        topS[k] = topS[k - 1];
                    }
                    topW[j] = w;
                    topS[j] = sc;
                    break;
                }
            }
        }

        s.topPredictors = topW;
        s.topScores     = topS;
        s.finalized     = true;

        emit SeasonFinalized(seasonId, topW);
    }
}
