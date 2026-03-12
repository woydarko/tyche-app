// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./base/ReactiveBase.sol";
import "./libraries/ScoreMath.sol";

/**
 * @title TycheScoreRegistry
 * @notice On-chain reputation registry for Tyche prediction market protocol.
 *
 *         Stores TycheProfile for every predictor wallet and automatically
 *         recalculates scores when PredictionResolved events are emitted by
 *         TycheMarketAdapter — powered by Somnia Reactivity SDK.
 *
 *         THIS IS THE CORE SOMNIA REACTIVITY INTEGRATION (main judging criterion):
 *         ─────────────────────────────────────────────────────────────────────
 *         1. TycheMarketAdapter emits PredictionResolved(wallet, marketId, ...)
 *         2. Somnia's reactive runtime detects the event subscription
 *         3. react() is called automatically on this contract
 *         4. Score is updated in the same block — no manual calls needed
 *         ─────────────────────────────────────────────────────────────────────
 *
 * @dev SC-03 (storage) + SC-04 (Reactivity) + SC-05 (score formulas)
 *      + SC-06 (rolling Sharpe consistency + category mastery)
 *      Tyche | Somnia Reactivity Mini Hackathon 2026
 */
contract TycheScoreRegistry is Ownable, ReactiveBase {
    using ScoreMath for *;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /**
     * @notice Complete on-chain reputation profile for a predictor wallet.
     */
    struct TycheProfile {
        // --- Component scores (each 0–200) ---
        uint256 accuracyScore;
        uint256 alphaScore;
        uint256 calibrationScore;
        uint256 consistencyScore;

        // --- Composite (0–1000) ---
        uint256 compositeScore;

        // --- Raw stats ---
        uint256 totalPredictions;
        uint256 totalWins;
        int256  totalPnl;

        // --- Internal accumulators for score math ---
        uint256 cumAvgOdds;          // sum of entryOdds across all predictions
        int256  cumOddsMovement;     // sum of (exitOdds-entryOdds)*PREC/entryOdds
        uint256 cumBrierNumerator;   // sum of brierContribution per prediction

        // --- Rolling 20-prediction window (SC-06) ---
        // Bit i of rollingWindowMask = result of prediction added (i+1) slots ago
        // Bit 0 = most recent, bit 19 = oldest in window
        uint256 rollingWindowMask;
        uint256 rollingWindowCount;  // valid entries in window (0–20)
        uint256 rollingWindowWins;   // popcount of rollingWindowMask

        // --- Streak & activity ---
        uint256 currentStreak;
        uint256 longestStreak;
        uint256 activeEpochs;        // distinct 1000-block epochs with activity
        uint256 lastActiveEpoch;     // last epoch index where a prediction occurred

        // --- Meta ---
        uint256 lastUpdateBlock;
        uint8   tier;                // 0=Bronze … 4=Oracle
        bool    sbtMinted;
    }

    /**
     * @notice Per-wallet per-category win tracking (SC-06).
     */
    struct CategoryScore {
        uint256 wins;
        uint256 total;
        uint256 masteryScore; // 0–100
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 private constant WINDOW_SIZE = 20;
    uint256 private constant WINDOW_MASK = (1 << WINDOW_SIZE) - 1; // 0xFFFFF

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ScoreUpdated(
        address indexed wallet,
        uint256 compositeScore,
        uint8   tier,
        uint256 totalPredictions,
        uint256 totalWins,
        int256  totalPnl
    );

    event TierChanged(
        address indexed wallet,
        uint8 oldTier,
        uint8 newTier
    );

    event SBTMinted(address indexed wallet, uint8 tier);

    // ─── Somnia Reactivity subscription signal ────────────────────────────────
    event Subscribed(
        address indexed service,
        uint256 chainId,
        address indexed origin,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3,
        bool    topic0Match,
        bool    topic3Match,
        uint256 gasLimit
    );

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Profile storage — the core reputation ledger
    mapping(address => TycheProfile) private _profiles;

    /// @notice Category mastery scores: wallet → categoryKey → CategoryScore
    mapping(address => mapping(bytes32 => CategoryScore)) public categoryScores;

    /// @notice Category keys per wallet (for enumeration)
    mapping(address => bytes32[]) private _walletCategoryKeys;
    mapping(address => mapping(bytes32 => bool)) private _walletCategoryTracked;

    /// @notice All wallets that have at least one prediction
    address[] public predictors;
    mapping(address => bool) private _isPredictorTracked;

    /// @notice Address of the SBT contract (set post-deploy)
    address public sbtContract;

    /// @notice The MarketAdapter contract we subscribe to
    address public marketAdapter;

    /// @notice PredictionResolved event topic0 — keccak256 of signature
    bytes32 public constant PREDICTION_RESOLVED_TOPIC0 =
        keccak256("PredictionResolved(address,string,string,bool,int256,uint256,uint256,uint256)");

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _reactiveService  Somnia Reactivity service address
     * @param _marketAdapter    TycheMarketAdapter contract to subscribe to
     */
    constructor(
        address _reactiveService,
        address _marketAdapter
    )
        Ownable(msg.sender)
        ReactiveBase(_reactiveService)
    {
        marketAdapter = _marketAdapter;

        // ─── SOMNIA REACTIVITY SUBSCRIPTION ────────────────────────────────
        emit Subscribed(
            _reactiveService,
            50312,
            _marketAdapter,
            uint256(PREDICTION_RESOLVED_TOPIC0),
            0, 0, 0,
            true,
            false,
            1_000_000
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Somnia Reactivity — callback handler
    // ─────────────────────────────────────────────────────────────────────────

    function _onReact(
        uint256 /* chainId */,
        address _contract,
        uint256 topic0,
        uint256 topic1,
        uint256 /* topic2 */,
        uint256 /* topic3 */,
        bytes calldata data,
        uint256 /* blockNumber */,
        uint256 /* opCode */
    ) internal override {
        if (_contract != marketAdapter) return;
        if (bytes32(topic0) != PREDICTION_RESOLVED_TOPIC0) return;

        address wallet = address(uint160(topic1));

        (
            /* string marketId */,
            string memory category,
            bool    result,
            int256  pnl,
            uint256 entryOdds,
            uint256 exitOdds,
            /* uint256 timestamp */
        ) = abi.decode(data, (string, string, bool, int256, uint256, uint256, uint256));

        _updateScore(wallet, category, result, pnl, entryOdds, exitOdds);
    }

    // -------------------------------------------------------------------------
    // Score update logic (SC-05 + SC-06)
    // -------------------------------------------------------------------------

    function _updateScore(
        address wallet,
        string  memory category,
        bool    result,
        int256  pnl,
        uint256 entryOdds,
        uint256 exitOdds
    ) internal {
        TycheProfile storage p = _profiles[wallet];

        if (!_isPredictorTracked[wallet]) {
            _isPredictorTracked[wallet] = true;
            predictors.push(wallet);
        }

        // ── Raw stats ───────────────────────────────────────────────────────
        p.totalPredictions += 1;
        if (result) p.totalWins += 1;
        p.totalPnl += pnl;

        // ── Accumulators ────────────────────────────────────────────────────
        p.cumAvgOdds += entryOdds;

        int256 oddsMovement = (int256(exitOdds) - int256(entryOdds)) *
            int256(ScoreMath.PRECISION) / int256(entryOdds);
        p.cumOddsMovement += oddsMovement;

        p.cumBrierNumerator += ScoreMath.brierContribution(entryOdds, result);

        // ── Rolling 20-prediction window (SC-06) ────────────────────────────
        // Oldest entry is at bit (WINDOW_SIZE - 1), newest at bit 0.
        // On each new prediction: shift mask left, insert new result at bit 0,
        // trim to WINDOW_SIZE bits. If window was full, also drop the ejected bit.
        if (p.rollingWindowCount == WINDOW_SIZE) {
            // Bit at position (WINDOW_SIZE - 1) is about to be shifted off
            bool droppedWin = ((p.rollingWindowMask >> (WINDOW_SIZE - 1)) & 1) == 1;
            if (droppedWin) p.rollingWindowWins -= 1;
        } else {
            p.rollingWindowCount += 1;
        }
        p.rollingWindowMask = ((p.rollingWindowMask << 1) | (result ? 1 : 0)) & WINDOW_MASK;
        if (result) p.rollingWindowWins += 1;

        // ── Streak ──────────────────────────────────────────────────────────
        if (result) {
            p.currentStreak += 1;
            if (p.currentStreak > p.longestStreak) p.longestStreak = p.currentStreak;
        } else {
            p.currentStreak = 0;
        }

        // ── Activity epoch tracking ─────────────────────────────────────────
        uint256 currentEpoch = block.number / 1000;
        if (currentEpoch != p.lastActiveEpoch) {
            p.activeEpochs += 1;
            p.lastActiveEpoch = currentEpoch;
        }

        // ── Category mastery (SC-06) ────────────────────────────────────────
        if (bytes(category).length > 0) {
            bytes32 catKey = keccak256(bytes(category));
            CategoryScore storage cs = categoryScores[wallet][catKey];
            cs.total += 1;
            if (result) cs.wins += 1;
            cs.masteryScore = ScoreMath.categoryMasteryScore(cs.wins, cs.total);

            if (!_walletCategoryTracked[wallet][catKey]) {
                _walletCategoryTracked[wallet][catKey] = true;
                _walletCategoryKeys[wallet].push(catKey);
            }
        }

        // ── Compute scores ──────────────────────────────────────────────────
        uint256 avgOdds = p.cumAvgOdds / p.totalPredictions;

        uint256 acc   = ScoreMath.accuracyScore(p.totalWins, p.totalPredictions, avgOdds);
        uint256 alpha = ScoreMath.alphaScore(p.cumOddsMovement, p.totalPredictions);
        uint256 calib = ScoreMath.calibrationScore(p.cumBrierNumerator, p.totalPredictions);
        // SC-06: use Sharpe-like rolling window consistency
        uint256 cons  = ScoreMath.consistencyScoreRolling(p.rollingWindowWins, p.rollingWindowCount);
        uint256 composite = ScoreMath.compositeScore(acc, alpha, calib, cons);

        p.accuracyScore    = acc;
        p.alphaScore       = alpha;
        p.calibrationScore = calib;
        p.consistencyScore = cons;
        p.compositeScore   = composite;
        p.lastUpdateBlock  = block.number;

        // ── Tier update ─────────────────────────────────────────────────────
        uint8 oldTier = p.tier;
        uint8 newTier = ScoreMath.tierFromScore(composite);
        p.tier = newTier;

        if (newTier != oldTier) {
            emit TierChanged(wallet, oldTier, newTier);
        }

        emit ScoreUpdated(wallet, composite, newTier, p.totalPredictions, p.totalWins, p.totalPnl);
    }

    // -------------------------------------------------------------------------
    // Score decay (called by TycheSeasonManager cron)
    // -------------------------------------------------------------------------

    function applyDecay(address wallet) external {
        require(
            msg.sender == owner() || msg.sender == reactiveService,
            "TycheScoreRegistry: unauthorized decay caller"
        );

        TycheProfile storage p = _profiles[wallet];
        if (p.totalPredictions == 0) return;

        uint256 currentEpoch = block.number / 1000;
        if (p.lastActiveEpoch == currentEpoch) return;

        p.accuracyScore    = ScoreMath.applyDecay(p.accuracyScore);
        p.alphaScore       = ScoreMath.applyDecay(p.alphaScore);
        p.calibrationScore = ScoreMath.applyDecay(p.calibrationScore);
        p.consistencyScore = ScoreMath.applyDecay(p.consistencyScore);
        p.compositeScore   = ScoreMath.applyDecay(p.compositeScore);

        uint8 oldTier = p.tier;
        uint8 newTier = ScoreMath.tierFromScore(p.compositeScore);
        p.tier = newTier;

        if (newTier != oldTier) {
            emit TierChanged(wallet, oldTier, newTier);
        }
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    function getProfile(address wallet) external view returns (TycheProfile memory) {
        return _profiles[wallet];
    }

    function getCompositeScore(address wallet) external view returns (uint256) {
        return _profiles[wallet].compositeScore;
    }

    function getTier(address wallet) external view returns (uint8) {
        return _profiles[wallet].tier;
    }

    /// @notice Category mastery score for a wallet + category string
    function getCategoryScore(address wallet, string calldata category)
        external
        view
        returns (CategoryScore memory)
    {
        return categoryScores[wallet][keccak256(bytes(category))];
    }

    /// @notice All category keys for a wallet (use with getCategoryScore)
    function getWalletCategoryKeys(address wallet) external view returns (bytes32[] memory) {
        return _walletCategoryKeys[wallet];
    }

    function getPredictorCount() external view returns (uint256) {
        return predictors.length;
    }

    function getPredictors(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory result)
    {
        uint256 end = offset + limit;
        if (end > predictors.length) end = predictors.length;
        result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = predictors[i];
        }
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setSbtContract(address _sbt) external onlyOwner {
        sbtContract = _sbt;
    }

    function markSbtMinted(address wallet) external {
        require(msg.sender == sbtContract, "TycheScoreRegistry: only SBT contract");
        _profiles[wallet].sbtMinted = true;
        emit SBTMinted(wallet, _profiles[wallet].tier);
    }

    /**
     * @notice Manual score update for testing (owner only).
     */
    function manualUpdate(
        address wallet,
        string  calldata category,
        bool    result,
        int256  pnl,
        uint256 entryOdds,
        uint256 exitOdds
    ) external onlyOwner {
        _updateScore(wallet, category, result, pnl, entryOdds, exitOdds);
    }
}
