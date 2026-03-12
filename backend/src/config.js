// src/config.js — centralised configuration from environment variables

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/tyche',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  somnia: {
    rpcUrl: process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network',
    chainId: parseInt(process.env.CHAIN_ID || '50312', 10),
  },

  contracts: {
    scoreRegistry: process.env.CONTRACT_SCORE_REGISTRY || '0x90ab2482E83BE7A1Ae550b8C789bc6701267adA0',
    marketAdapter: process.env.CONTRACT_MARKET_ADAPTER || '0x3728Df6fF0cCcEeFd6E98c88beeCfc308Af4F1E4',
    seasonManager: process.env.CONTRACT_SEASON_MANAGER || '0x2720aE609232892118aDC314f44679dB13F50267',
    mockMarket: process.env.CONTRACT_MOCK_MARKET || '0xA278c23F935980d903E8Da3d25379b2B5Ec3D16a',
    // These may not be deployed yet — handle gracefully
    sbt: process.env.CONTRACT_SBT || '',
    social: process.env.CONTRACT_SOCIAL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change_me_in_production',
    expiresIn: '7d',
  },

  pinata: {
    apiKey: process.env.PINATA_API_KEY || '',
    secretApiKey: process.env.PINATA_SECRET_API_KEY || '',
  },

  eth: {
    mainnetRpc: process.env.ETH_MAINNET_RPC || 'https://eth.llamarpc.com',
  },

  // Tier names corresponding to uint8 values from contracts
  tiers: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Oracle'],
};

export default config;
