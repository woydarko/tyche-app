// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ScoreMath
 * @notice Fixed-point math library for Tyche score calculations.
 *         All scores use integer arithmetic only (no floats in Solidity).
 *
 *         PRECISION = 1e6 for internal intermediate values.
 *         Final scores are scaled to their respective ranges before storage.
 *
 * Score components (each 0–200, composite 0–1000):
 *   - Accuracy    : win rate weighted by prediction difficulty
 *   - Alpha       : entry timing advantage vs odds movement
 *   - Calibration : Brier Score adaptation (confidence quality)
 *   - Consistency : activity regularity + streak bonus
 *   - Composite   : weighted sum of all four, scaled to 0–1000
 *
 * @dev SC-05 + SC-06 — Tyche | Somnia Reactivity Mini Hackathon 2026
 */
library ScoreMath {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 internal constant PRECISION     = 1e6;   // fixed-point base
    uint256 internal constant ODDS_SCALE    = 1e4;   // entryOdds/exitOdds scale
    uint256 internal constant MAX_COMPONENT = 200;   // max per score component
    uint256 internal constant MAX_COMPOSITE = 1000;  // max composite score

    // Composite weights (must sum to 1000 / MAX_COMPOSITE = 5x)
    // weights are out of 10_000 for precision
    uint256 internal constant W_ACCURACY    = 3000;  // 30%
    uint256 internal constant W_ALPHA       = 2500;  // 25%
    uint256 internal constant W_CALIBRATION = 2500;  // 25%
    uint256 internal constant W_CONSISTENCY = 2000;  // 20%

    // -------------------------------------------------------------------------
    // Accuracy Score  (0–200)
    // -------------------------------------------------------------------------

    /**
     * @notice Compute accuracy score.
     *         accuracy = (wins / total) * difficultyMultiplier, capped at 200.
     *
     *         difficultyMultiplier rewards predicting low-probability outcomes.
     *         If avgEntryOdds = 5000 (50%), multiplier = 1.0 (baseline).
     *         If avgEntryOdds = 2000 (20%), multiplier = 1.5 (harder prediction).
     *         If avgEntryOdds = 9000 (90%), multiplier = 0.6 (easy prediction).
     *
     * @param wins              Total correct predictions
     * @param total             Total predictions
     * @param avgEntryOdds      Average entry odds, scaled 1e4
     * @return score            0–200
     */
    function accuracyScore(
        uint256 wins,
        uint256 total,
        uint256 avgEntryOdds
    ) internal pure returns (uint256 score) {
        if (total == 0) return 0;

        // winRate in PRECISION units (0 to PRECISION)
        uint256 winRate = (wins * PRECISION) / total;

        // difficultyMultiplier: lower odds → higher multiplier
        // multiplier = (ODDS_SCALE / avgEntryOdds) * 0.5 + 0.5
        // → scaled as PRECISION units
        // e.g. 50% odds → (10000/5000)*0.5 + 0.5 = 1.5? Let's keep it simpler:
        // multiplier = PRECISION * 5000 / avgEntryOdds  (baseline at 50% = 1.0x)
        uint256 multiplier = (PRECISION * 5000) / avgEntryOdds;
        // cap multiplier at 2.0x (rewarding extreme underdogs, not infinitely)
        if (multiplier > 2 * PRECISION) multiplier = 2 * PRECISION;
        // floor multiplier at 0.5x
        if (multiplier < PRECISION / 2) multiplier = PRECISION / 2;

        // raw = winRate * multiplier / PRECISION → 0 to 2*PRECISION
        uint256 raw = (winRate * multiplier) / PRECISION;

        // scale to 0–200: raw is 0–2*PRECISION, max desired is 200
        score = (raw * MAX_COMPONENT) / (2 * PRECISION);
        if (score > MAX_COMPONENT) score = MAX_COMPONENT;
    }

    // -------------------------------------------------------------------------
    // Alpha Score  (0–200)
    // -------------------------------------------------------------------------

    /**
     * @notice Compute alpha score from accumulated odds movement data.
     *         alpha = average((exitOdds - entryOdds) / entryOdds), scaled 0–200.
     *
     *         Positive alpha: you entered before odds improved (you were early).
     *         Negative alpha: you entered late (odds moved against you).
     *
     *         Score is shifted so that 0 alpha → 100, max positive → 200,
     *         max negative → 0.
     *
     * @param cumOddsMovement   Sum of (exitOdds - entryOdds) * PRECISION / entryOdds
     *                          (accumulated, can be negative stored as int256)
     * @param total             Total predictions
     * @return score            0–200
     */
    function alphaScore(
        int256  cumOddsMovement,
        uint256 total
    ) internal pure returns (uint256 score) {
        if (total == 0) return 100; // neutral baseline

        // avgMovement in PRECISION units, signed
        int256 avg = cumOddsMovement / int256(total);

        // Map [-PRECISION, +PRECISION] → [0, 200]
        // score = 100 + avg * 100 / PRECISION
        int256 raw = 100 + (avg * 100) / int256(PRECISION);

        if (raw < 0)   return 0;
        if (raw > 200) return 200;
        return uint256(raw);
    }

    // -------------------------------------------------------------------------
    // Calibration Score  (0–200)  — Brier Score adaptation
    // -------------------------------------------------------------------------

    /**
     * @notice Compute calibration score from accumulated Brier score.
     *         Brier Score = mean((confidence - outcome)^2).
     *         Perfect calibration (BS=0) → 200. Worst (BS=1) → 0.
     *
     *         calibration = (1 - brierScore) * 200
     *
     *         Using entryOdds as the confidence proxy:
     *         - Win prediction with 75% confidence: (0.75 - 1)^2 = 0.0625
     *         - Loss prediction with 75% confidence: (0.75 - 0)^2 = 0.5625
     *
     * @param cumBrierNumerator  Sum of (confidence - outcome)^2 in PRECISION^2 units
     * @param total              Total predictions
     * @return score             0–200
     */
    function calibrationScore(
        uint256 cumBrierNumerator,
        uint256 total
    ) internal pure returns (uint256 score) {
        if (total == 0) return 100; // neutral baseline

        // avgBrier in PRECISION^2 units → normalize to PRECISION
        uint256 avgBrier = cumBrierNumerator / total; // in PRECISION^2 units

        // brierScore is in range [0, PRECISION^2] representing [0, 1]
        // calibration = (PRECISION^2 - avgBrier) * 200 / PRECISION^2
        if (avgBrier >= PRECISION * PRECISION) return 0;

        uint256 invBrier = (PRECISION * PRECISION) - avgBrier;
        score = (invBrier * MAX_COMPONENT) / (PRECISION * PRECISION);
        if (score > MAX_COMPONENT) score = MAX_COMPONENT;
    }

    /**
     * @notice Compute per-prediction Brier contribution.
     *         confidence = entryOdds / ODDS_SCALE (scaled to PRECISION)
     *         outcome = 1 (win) or 0 (loss)
     *         brier = (confidence - outcome)^2 in PRECISION^2 units
     */
    function brierContribution(
        uint256 entryOdds,
        bool    win
    ) internal pure returns (uint256) {
        // confidence in PRECISION units
        uint256 confidence = (entryOdds * PRECISION) / ODDS_SCALE;
        int256  diff;
        if (win) {
            diff = int256(confidence) - int256(PRECISION);
        } else {
            diff = int256(confidence);
        }
        // diff^2 in PRECISION^2 units
        return uint256(diff * diff);
    }

    // -------------------------------------------------------------------------
    // Consistency Score  (0–200)
    // -------------------------------------------------------------------------

    /**
     * @notice Compute consistency score based on activity regularity and streak.
     *         consistency = streakBonus * 0.5 + activityBonus * 0.5
     *
     * @param currentStreak     Current consecutive win streak
     * @param totalPredictions  Total predictions ever made
     * @param activeEpochs      Number of distinct epochs (1000-block windows) active
     * @param totalEpochs       Total elapsed epochs
     * @return score            0–200
     */
    function consistencyScore(
        uint256 currentStreak,
        uint256 totalPredictions,
        uint256 activeEpochs,
        uint256 totalEpochs
    ) internal pure returns (uint256 score) {
        // Streak bonus: log-like scaling, cap at 100
        uint256 streakBonus = currentStreak * 10;
        if (streakBonus > 100) streakBonus = 100;

        // Activity bonus: fraction of epochs active, scaled to 100
        uint256 activityBonus = 0;
        if (totalEpochs > 0 && totalPredictions > 0) {
            activityBonus = (activeEpochs * 100) / totalEpochs;
            if (activityBonus > 100) activityBonus = 100;
        }

        score = streakBonus + activityBonus;
        if (score > MAX_COMPONENT) score = MAX_COMPONENT;
    }

    // -------------------------------------------------------------------------
    // Composite Score  (0–1000)
    // -------------------------------------------------------------------------

    /**
     * @notice Weighted composite of all four component scores.
     *         composite = acc*30% + alpha*25% + calib*25% + consist*20%, scaled to 1000.
     */
    function compositeScore(
        uint256 accuracy,
        uint256 alpha,
        uint256 calibration,
        uint256 consistency
    ) internal pure returns (uint256) {
        uint256 weighted =
            accuracy    * W_ACCURACY    +
            alpha       * W_ALPHA       +
            calibration * W_CALIBRATION +
            consistency * W_CONSISTENCY;

        // weighted / 10_000 gives value in same range as components (0–200)
        // then scale to 0–1000: * 1000 / 200
        uint256 composite = (weighted * MAX_COMPOSITE) / (MAX_COMPONENT * 10_000);
        if (composite > MAX_COMPOSITE) composite = MAX_COMPOSITE;
        return composite;
    }

    // -------------------------------------------------------------------------
    // Tier
    // -------------------------------------------------------------------------

    /**
     * @notice Determine tier from composite score.
     *         0 = Bronze  (0–199)
     *         1 = Silver  (200–399)
     *         2 = Gold    (400–599)
     *         3 = Platinum (600–799)
     *         4 = Oracle  (800–1000)
     */
    function tierFromScore(uint256 composite) internal pure returns (uint8) {
        if (composite >= 800) return 4;
        if (composite >= 600) return 3;
        if (composite >= 400) return 2;
        if (composite >= 200) return 1;
        return 0;
    }

    // -------------------------------------------------------------------------
    // Consistency Score — Rolling window Sharpe-like (SC-06)
    // -------------------------------------------------------------------------

    uint256 internal constant ROLLING_WINDOW = 20;

    /**
     * @notice Compute Sharpe-like consistency score from a rolling 20-prediction window.
     *         Sharpe = E[R] / σ[R]. For binary outcomes:
     *           E[R] = p,  σ[R] = sqrt(p(1-p))
     *           Sharpe = p / sqrt(p(1-p)) = sqrt(p / (1-p))
     *
     *         Scaled to 0–200:
     *           p = 0.5  → Sharpe = 1.00 → score = 100  (baseline)
     *           p = 0.8  → Sharpe = 2.00 → score = 200  (cap)
     *           p = 0.0  → Sharpe = 0.00 → score = 0
     *
     * @param windowWins   Number of wins in the rolling window
     * @param windowCount  Total predictions in window (1–20)
     * @return score       0–200
     */
    function consistencyScoreRolling(
        uint256 windowWins,
        uint256 windowCount
    ) internal pure returns (uint256 score) {
        if (windowCount == 0) return 100; // neutral baseline

        uint256 losses = windowCount - windowWins;
        if (losses == 0) return MAX_COMPONENT; // perfect — all wins

        // Sharpe = sqrt(wins / losses), in PRECISION units
        // score  = sqrt(wins * PRECISION / losses) * 100 / sqrt(PRECISION)
        //        = sqrt(wins * PRECISION / losses) * 100 / 1000   (sqrt(1e6)=1000)
        uint256 ratio    = (windowWins * PRECISION) / losses;
        uint256 sqrtRatio = _sqrt(ratio);
        score = (sqrtRatio * 100) / 1000; // 1000 = sqrt(PRECISION) = sqrt(1e6)
        if (score > MAX_COMPONENT) score = MAX_COMPONENT;
    }

    // -------------------------------------------------------------------------
    // Category Mastery Score  (0–100)  (SC-06)
    // -------------------------------------------------------------------------

    /**
     * @notice Compute mastery score for a specific market category.
     *         masteryScore = winRate * confidence_weight, scaled 0–100.
     *
     *         confidence_weight ramps from 0 → 1 as predictions grow to 10+,
     *         so early stats don't dominate and specialization is rewarded.
     *
     * @param wins   Wins in this category
     * @param total  Total predictions in this category
     * @return score 0–100
     */
    function categoryMasteryScore(
        uint256 wins,
        uint256 total
    ) internal pure returns (uint256 score) {
        if (total == 0) return 0;

        // Win rate 0–100
        uint256 winRate = (wins * 100) / total;

        // Confidence weight: grows linearly from 0 to 100 as total reaches 10
        uint256 weight = total >= 10 ? 100 : (total * 10);

        // masteryScore = winRate * weight / 100
        score = (winRate * weight) / 100;
        if (score > 100) score = 100;
    }

    // -------------------------------------------------------------------------
    // Integer square root (Babylonian method)
    // -------------------------------------------------------------------------

    /**
     * @notice Compute integer square root of x (floor).
     * @dev    Babylonian method — O(log x) iterations.
     */
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    // -------------------------------------------------------------------------
    // Decay
    // -------------------------------------------------------------------------

    /**
     * @notice Apply 2% decay to a score value (used by cron decay job).
     */
    function applyDecay(uint256 score) internal pure returns (uint256) {
        return (score * 98) / 100;
    }
}
