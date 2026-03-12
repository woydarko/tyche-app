require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);
const SOMNIA_RPC = process.env.SOMNIA_RPC || "https://dream-rpc.somnia.network";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      evmVersion: "cancun",
    },
  },

  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
    },

    // Somnia Testnet
    somnia: {
      url: SOMNIA_RPC,
      chainId: 50312,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
      timeout: 60000,
    },
  },

  // Gas reporting
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },

  // Source verification (Somnia block explorer)
  etherscan: {
    apiKey: {
      somnia: process.env.SOMNIA_EXPLORER_API_KEY || "placeholder",
    },
    customChains: [
      {
        network: "somnia",
        chainId: 50312,
        urls: {
          apiURL: "https://shannon-explorer.somnia.network/api",
          browserURL: "https://shannon-explorer.somnia.network",
        },
      },
    ],
  },

  // Compilation artifacts output
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
