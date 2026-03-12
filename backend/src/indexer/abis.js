// src/indexer/abis.js — Minimal event ABIs for all contracts

export const MockPredictionMarketABI = [
  'event MarketCreated(uint256 indexed marketId, string title, string category)',
  'event BetPlaced(uint256 indexed marketId, address indexed wallet, bool position, uint256 entryOdds, uint256 amount)',
  'event MarketResolved(uint256 indexed marketId, bool outcome)',
  'event BetSettled(uint256 indexed marketId, address indexed wallet, bool won, int256 pnl)',
];

export const TycheScoreRegistryABI = [
  'event ScoreUpdated(address indexed wallet, uint256 compositeScore, uint8 tier, uint256 totalPredictions, uint256 totalWins, int256 totalPnl)',
  'event TierChanged(address indexed wallet, uint8 oldTier, uint8 newTier)',
  'event SBTMinted(address indexed wallet, uint8 tier)',
  // getProfile function for querying wallet profiles
  `function getProfile(address wallet) external view returns (
    uint256 accuracyScore,
    uint256 alphaScore,
    uint256 calibrationScore,
    uint256 consistencyScore,
    uint256 compositeScore,
    uint256 totalPredictions,
    uint256 totalWins,
    int256  totalPnl,
    uint256 cumAvgOdds,
    int256  cumOddsMovement,
    uint256 cumBrierNumerator,
    uint256 rollingWindowMask,
    uint256 rollingWindowCount,
    uint256 rollingWindowWins,
    uint256 currentStreak,
    uint256 longestStreak,
    uint256 activeEpochs,
    uint256 lastActiveEpoch,
    uint256 lastUpdateBlock,
    uint8   tier,
    bool    sbtMinted
  )`,
];

export const TycheSocialABI = [
  'event FollowCreated(address indexed follower, address indexed target)',
  'event FollowRemoved(address indexed follower, address indexed target)',
];

export const TycheSeasonManagerABI = [
  'event SeasonStarted(uint256 indexed seasonId, uint256 startBlock, uint256 endBlock)',
  'event SeasonFinalized(uint256 indexed seasonId, address[10] topPredictors)',
];
