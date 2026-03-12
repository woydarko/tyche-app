// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TycheMarketAdapter
 * @notice Entry point for the Tyche reactive pipeline.
 *
 *         Normalizes prediction market resolution events from any authorized
 *         prediction market contract into the canonical PredictionResolved event.
 *         TycheScoreRegistry subscribes to this event via Somnia Reactivity SDK
 *         and automatically updates reputation scores on each resolution.
 *
 * @dev SC-02 — Tyche | Somnia Reactivity Mini Hackathon 2026
 */
contract TycheMarketAdapter is Ownable {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * @notice Canonical event consumed by the Somnia Reactivity pipeline.
     *         TycheScoreRegistry subscribes to this and reacts automatically.
     *
     * @param wallet     Predictor wallet address
     * @param marketId   External market identifier (e.g. "MOCK-0", "POLYMARKET-abc")
     * @param category   Market category (e.g. "crypto", "sports", "politics")
     * @param result     true = predictor won, false = predictor lost
     * @param pnl        Profit/loss in wei-equivalent units (signed)
     * @param entryOdds  Implied probability at entry, scaled 1e4 (7500 = 75.00%)
     * @param exitOdds   Implied probability at resolution, scaled 1e4
     * @param timestamp  Block timestamp of resolution
     */
    event PredictionResolved(
        address indexed wallet,
        string  marketId,
        string  category,
        bool    result,
        int256  pnl,
        uint256 entryOdds,
        uint256 exitOdds,
        uint256 timestamp
    );

    /// @notice Emitted when a market contract authorization changes
    event MarketAuthorized(address indexed market, bool authorized);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Contracts allowed to report resolutions (e.g. MockPredictionMarket)
    mapping(address => bool) public authorizedMarkets;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyAuthorized() {
        require(
            authorizedMarkets[msg.sender] || msg.sender == owner(),
            "TycheMarketAdapter: caller not authorized"
        );
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /**
     * @notice Authorize or revoke a market contract's ability to report resolutions.
     * @param market     The market contract address
     * @param authorized true to authorize, false to revoke
     */
    function setMarketAuthorization(address market, bool authorized) external onlyOwner {
        authorizedMarkets[market] = authorized;
        emit MarketAuthorized(market, authorized);
    }

    // -------------------------------------------------------------------------
    // Core
    // -------------------------------------------------------------------------

    /**
     * @notice Report a prediction resolution. Emits PredictionResolved which
     *         triggers automatic score updates in TycheScoreRegistry via
     *         Somnia Reactivity.
     *
     * @param wallet     The predictor's wallet address
     * @param marketId   External identifier for the market
     * @param category   Category label for the market
     * @param result     Whether the predictor was correct
     * @param pnl        Profit/loss (signed, in wei-equivalent units)
     * @param entryOdds  Implied probability at entry (scaled 1e4)
     * @param exitOdds   Implied probability at resolution (scaled 1e4)
     */
    function reportResolution(
        address wallet,
        string  calldata marketId,
        string  calldata category,
        bool    result,
        int256  pnl,
        uint256 entryOdds,
        uint256 exitOdds
    ) external onlyAuthorized {
        require(wallet != address(0), "TycheMarketAdapter: zero address");
        require(entryOdds > 0 && entryOdds <= 1e4, "TycheMarketAdapter: invalid entryOdds");
        require(exitOdds  > 0 && exitOdds  <= 1e4, "TycheMarketAdapter: invalid exitOdds");

        emit PredictionResolved(
            wallet,
            marketId,
            category,
            result,
            pnl,
            entryOdds,
            exitOdds,
            block.timestamp
        );
    }
}
