// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../TycheMarketAdapter.sol";

/**
 * @title MockPredictionMarket
 * @notice Simulates a simple YES/NO binary prediction market for demo and testing.
 *
 *         Flow:
 *           1. createMarket()  — owner creates a YES/NO market
 *           2. placeBet()      — any wallet bets YES or NO with entry odds
 *           3. resolveMarket() — owner resolves with the true outcome
 *           4. MockPredictionMarket reports results to TycheMarketAdapter
 *           5. TycheMarketAdapter emits PredictionResolved
 *           6. Somnia Reactivity triggers TycheScoreRegistry.react() automatically
 *
 *         Used to demonstrate the full reactive pipeline on Somnia testnet.
 *
 * @dev SC-13 — Tyche | Somnia Reactivity Mini Hackathon 2026
 */
contract MockPredictionMarket is Ownable {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum MarketState { Open, Resolved }

    struct Market {
        uint256      id;
        string       title;
        string       category;
        MarketState  state;
        bool         outcome;     // true = YES won, false = NO won
        uint256      createdAt;
        uint256      resolvedAt;
        uint256      totalBets;
    }

    struct Bet {
        address  wallet;
        uint256  marketId;
        bool     position;    // true = bet YES, false = bet NO
        uint256  entryOdds;   // implied probability of bet side, scaled 1e4 (e.g. 6000 = 60%)
        uint256  amount;      // nominal bet amount (in wei)
        bool     settled;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event MarketCreated(uint256 indexed marketId, string title, string category);
    event BetPlaced(uint256 indexed marketId, address indexed wallet, bool position, uint256 entryOdds, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event BetSettled(uint256 indexed marketId, address indexed wallet, bool won, int256 pnl);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    TycheMarketAdapter public adapter;

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    uint256 public betCount;
    mapping(uint256 => Bet) public bets;

    // marketId → list of betIds
    mapping(uint256 => uint256[]) public marketBets;

    // wallet → list of betIds
    mapping(address => uint256[]) public walletBets;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _adapter) Ownable(msg.sender) {
        adapter = TycheMarketAdapter(_adapter);
    }

    // -------------------------------------------------------------------------
    // Market management
    // -------------------------------------------------------------------------

    /**
     * @notice Create a new YES/NO prediction market.
     * @param title    Human-readable market question
     * @param category Market category (e.g. "crypto", "sports", "politics")
     * @return marketId The new market's ID
     */
    function createMarket(string calldata title, string calldata category)
        external
        onlyOwner
        returns (uint256 marketId)
    {
        marketCount += 1;
        marketId = marketCount;

        markets[marketId] = Market({
            id:         marketId,
            title:      title,
            category:   category,
            state:      MarketState.Open,
            outcome:    false,
            createdAt:  block.timestamp,
            resolvedAt: 0,
            totalBets:  0
        });

        emit MarketCreated(marketId, title, category);
    }

    // -------------------------------------------------------------------------
    // Betting
    // -------------------------------------------------------------------------

    /**
     * @notice Place a bet on a market.
     * @param marketId  The market to bet on
     * @param position  true = bet YES, false = bet NO
     * @param entryOdds Caller-specified implied probability of their position,
     *                  scaled 1e4 (must be 100–9900, i.e. 1%–99%)
     */
    function placeBet(uint256 marketId, bool position, uint256 entryOdds)
        external
        payable
    {
        require(marketId > 0 && marketId <= marketCount, "MockPredictionMarket: invalid market");
        Market storage m = markets[marketId];
        require(m.state == MarketState.Open, "MockPredictionMarket: market closed");
        require(entryOdds >= 100 && entryOdds <= 9900, "MockPredictionMarket: invalid odds");
        require(msg.value > 0, "MockPredictionMarket: bet amount required");

        betCount += 1;
        bets[betCount] = Bet({
            wallet:    msg.sender,
            marketId:  marketId,
            position:  position,
            entryOdds: entryOdds,
            amount:    msg.value,
            settled:   false
        });

        marketBets[marketId].push(betCount);
        walletBets[msg.sender].push(betCount);
        m.totalBets += 1;

        emit BetPlaced(marketId, msg.sender, position, entryOdds, msg.value);
    }

    // -------------------------------------------------------------------------
    // Resolution
    // -------------------------------------------------------------------------

    /**
     * @notice Resolve a market and settle all bets.
     *         For each bet, reports the result to TycheMarketAdapter which
     *         emits PredictionResolved → triggers Somnia Reactivity pipeline.
     *
     * @param marketId The market to resolve
     * @param outcome  true = YES won, false = NO won
     */
    function resolveMarket(uint256 marketId, bool outcome) external onlyOwner {
        require(marketId > 0 && marketId <= marketCount, "MockPredictionMarket: invalid market");
        Market storage m = markets[marketId];
        require(m.state == MarketState.Open, "MockPredictionMarket: already resolved");

        m.state      = MarketState.Resolved;
        m.outcome    = outcome;
        m.resolvedAt = block.timestamp;

        emit MarketResolved(marketId, outcome);

        // ── Settle each bet and report to TycheMarketAdapter ────────────────
        uint256[] storage betIds = marketBets[marketId];
        for (uint256 i = 0; i < betIds.length; i++) {
            _settleBet(betIds[i], m, outcome);
        }
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _settleBet(uint256 betId, Market storage m, bool outcome) internal {
        Bet storage b = bets[betId];
        if (b.settled) return;
        b.settled = true;

        bool won = (b.position == outcome);

        // PnL: winner gains their bet * (1/odds - 1), loser loses bet amount
        // exitOdds = settlement probability (100% if correct side, 0% floored to 100)
        int256 pnl;
        uint256 exitOdds;

        if (won) {
            // Won: exitOdds → near certainty (9500 cap to avoid division artifacts)
            exitOdds = 9500;
            // pnl = amount * (10000 / entryOdds - 1)  — simplified fixed payout
            pnl = int256((b.amount * (10000 - b.entryOdds)) / b.entryOdds);
            // Pay out winner
            (bool ok, ) = b.wallet.call{value: b.amount + uint256(pnl)}("");
            if (!ok) pnl = 0; // if transfer fails, don't revert whole resolution
        } else {
            // Lost: exitOdds → near zero (500 floor)
            exitOdds = 500;
            pnl = -int256(b.amount);
            // Amount stays in contract (protocol treasury)
        }

        emit BetSettled(m.id, b.wallet, won, pnl);

        // Report to adapter → triggers Reactivity → updates TycheScoreRegistry
        string memory marketIdStr = _uint2str(m.id);
        adapter.reportResolution(
            b.wallet,
            marketIdStr,
            m.category,
            won,
            pnl,
            b.entryOdds,
            exitOdds
        );
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    function getMarketBets(uint256 marketId) external view returns (uint256[] memory) {
        return marketBets[marketId];
    }

    function getWalletBets(address wallet) external view returns (uint256[] memory) {
        return walletBets[wallet];
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Withdraw accumulated protocol fees (lost bets)
    function withdraw() external onlyOwner {
        (bool ok, ) = owner().call{value: address(this).balance}("");
        require(ok, "MockPredictionMarket: withdraw failed");
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v;
        uint256 digits;
        while (tmp != 0) { digits++; tmp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { digits--; buf[digits] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }

    receive() external payable {}
}
