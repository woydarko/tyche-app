/**
 * Tyche — Master deployment script for Somnia testnet
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network somnia
 *
 * Prerequisites:
 *   - Copy .env.example to .env and set PRIVATE_KEY
 *   - Ensure deployer wallet has STT (Somnia testnet tokens)
 *   - Faucet: https://testnet.somnia.network (or Discord faucet)
 *
 * Deploys contracts in dependency order:
 *   1. TycheMarketAdapter
 *   2. TycheScoreRegistry  (reactive — subscribes to MarketAdapter events)
 *   3. TycheSeasonManager  (reactive cron — decay every 1000 blocks)
 *   4. MockPredictionMarket (authorizes adapter)
 *
 * After deploy:
 *   - Update CLAUDE.md contract addresses
 *   - Verify on https://shannon-explorer.somnia.network
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Somnia Reactivity service address (update if changed by Somnia team)
const REACTIVE_SERVICE = process.env.SOMNIA_REACTIVE_SERVICE || "0x0000000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log("═══════════════════════════════════════════════");
  console.log("  Tyche — Deploying to Somnia Testnet");
  console.log("═══════════════════════════════════════════════");
  console.log("Deployer :", deployer.address);
  console.log("Balance  :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");
  console.log("Network  :", network.name || "unknown");
  console.log("Chain ID :", network.chainId.toString());
  console.log("═══════════════════════════════════════════════\n");

  const addresses = {};

  // ── 1. TycheMarketAdapter ────────────────────────────────────────────────
  console.log("1/4  Deploying TycheMarketAdapter...");
  const AdapterFactory = await ethers.getContractFactory("TycheMarketAdapter");
  const adapter = await AdapterFactory.deploy();
  await adapter.waitForDeployment();
  addresses.TycheMarketAdapter = await adapter.getAddress();
  console.log("     ✓ TycheMarketAdapter:", addresses.TycheMarketAdapter);

  // ── 2. TycheScoreRegistry ────────────────────────────────────────────────
  console.log("2/4  Deploying TycheScoreRegistry...");
  const RegistryFactory = await ethers.getContractFactory("TycheScoreRegistry");
  const registry = await RegistryFactory.deploy(REACTIVE_SERVICE, addresses.TycheMarketAdapter);
  await registry.waitForDeployment();
  addresses.TycheScoreRegistry = await registry.getAddress();
  console.log("     ✓ TycheScoreRegistry:", addresses.TycheScoreRegistry);

  // ── 3. TycheSeasonManager ────────────────────────────────────────────────
  console.log("3/4  Deploying TycheSeasonManager...");
  const SeasonFactory = await ethers.getContractFactory("TycheSeasonManager");
  const seasonManager = await SeasonFactory.deploy(REACTIVE_SERVICE, addresses.TycheScoreRegistry);
  await seasonManager.waitForDeployment();
  addresses.TycheSeasonManager = await seasonManager.getAddress();
  console.log("     ✓ TycheSeasonManager:", addresses.TycheSeasonManager);

  // ── 4. MockPredictionMarket ──────────────────────────────────────────────
  console.log("4/4  Deploying MockPredictionMarket...");
  const MockFactory = await ethers.getContractFactory("MockPredictionMarket");
  const mock = await MockFactory.deploy(addresses.TycheMarketAdapter);
  await mock.waitForDeployment();
  addresses.MockPredictionMarket = await mock.getAddress();
  console.log("     ✓ MockPredictionMarket:", addresses.MockPredictionMarket);

  // ── Wire up permissions ──────────────────────────────────────────────────
  console.log("\n  Wiring permissions...");
  const tx1 = await adapter.setMarketAuthorization(addresses.MockPredictionMarket, true);
  await tx1.wait();
  console.log("     ✓ MockPredictionMarket authorized on TycheMarketAdapter");

  // ── Start first season ───────────────────────────────────────────────────
  console.log("  Starting Season 1...");
  const tx2 = await seasonManager.startSeason(0); // default SEASON_DURATION
  await tx2.wait();
  console.log("     ✓ Season 1 started");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════");
  Object.entries(addresses).forEach(([name, addr]) => {
    console.log(`  ${name.padEnd(25)} ${addr}`);
  });
  console.log("═══════════════════════════════════════════════");
  console.log("\nExplorer: https://shannon-explorer.somnia.network");
  console.log("\nUpdate CLAUDE.md with the above addresses.\n");

  // ── Save addresses to file ───────────────────────────────────────────────
  const outPath = path.join(__dirname, "../deployments.json");
  const deployment = {
    network:   network.name || "somnia",
    chainId:   network.chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer:  deployer.address,
    addresses,
  };
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log("Saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
