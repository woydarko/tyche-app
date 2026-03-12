const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("TycheScoreRegistry", function () {
  let registry, adapter, owner, alice, bob;
  const FAKE_REACTIVE_SERVICE = "0x0000000000000000000000000000000000000001";

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const AdapterFactory = await ethers.getContractFactory("TycheMarketAdapter");
    adapter = await AdapterFactory.deploy();

    const RegistryFactory = await ethers.getContractFactory("TycheScoreRegistry");
    registry = await RegistryFactory.deploy(FAKE_REACTIVE_SERVICE, await adapter.getAddress());
  });

  describe("Initial state", function () {
    it("profile starts empty", async function () {
      const p = await registry.getProfile(alice.address);
      expect(p.totalPredictions).to.equal(0n);
      expect(p.compositeScore).to.equal(0n);
      expect(p.tier).to.equal(0);
    });

    it("predictor count starts at 0", async function () {
      expect(await registry.getPredictorCount()).to.equal(0n);
    });
  });

  describe("manualUpdate (score calculation)", function () {
    it("tracks first prediction correctly", async function () {
      await registry.manualUpdate(alice.address, "crypto", true, ethers.parseEther("0.1"), 6000, 8000);

      const p = await registry.getProfile(alice.address);
      expect(p.totalPredictions).to.equal(1n);
      expect(p.totalWins).to.equal(1n);
      expect(p.compositeScore).to.be.gt(0n);
      expect(await registry.getPredictorCount()).to.equal(1n);
    });

    it("tracks losses correctly", async function () {
      await registry.manualUpdate(alice.address, "crypto", false, ethers.parseEther("-0.1"), 6000, 1000);

      const p = await registry.getProfile(alice.address);
      expect(p.totalPredictions).to.equal(1n);
      expect(p.totalWins).to.equal(0n);
      expect(p.totalPnl).to.equal(ethers.parseEther("-0.1"));
    });

    it("composite score increases with wins", async function () {
      // 5 wins in a row
      for (let i = 0; i < 5; i++) {
        await registry.manualUpdate(alice.address, "crypto", true, ethers.parseEther("0.1"), 5000, 8000);
      }
      const p = await registry.getProfile(alice.address);
      expect(p.compositeScore).to.be.gt(0n);
      expect(p.currentStreak).to.equal(5n);
    });

    it("streak resets on loss", async function () {
      await registry.manualUpdate(alice.address, "crypto", true, 0n, 5000, 7000);
      await registry.manualUpdate(alice.address, "crypto", true, 0n, 5000, 7000);
      await registry.manualUpdate(alice.address, "crypto", false, 0n, 5000, 2000);

      const p = await registry.getProfile(alice.address);
      expect(p.currentStreak).to.equal(0n);
      expect(p.longestStreak).to.equal(2n);
    });

    it("tier upgrades on sufficient score", async function () {
      // Many wins to push score high enough for tier 1 (Silver = 200+ composite)
      for (let i = 0; i < 30; i++) {
        await registry.manualUpdate(alice.address, "crypto", true, ethers.parseEther("0.1"), 3000, 9000);
      }
      const p = await registry.getProfile(alice.address);
      // Should be at least tier 1 (Silver)
      expect(p.tier).to.be.gte(1);
    });

    it("tracks multiple wallets independently", async function () {
      await registry.manualUpdate(alice.address, "crypto", true, 0n, 5000, 8000);
      await registry.manualUpdate(bob.address, "crypto", false, 0n, 5000, 2000);

      expect(await registry.getPredictorCount()).to.equal(2n);

      const pa = await registry.getProfile(alice.address);
      const pb = await registry.getProfile(bob.address);
      expect(pa.totalWins).to.equal(1n);
      expect(pb.totalWins).to.equal(0n);
    });
  });

  describe("applyDecay", function () {
    it("decays composite score by ~2%", async function () {
      // Give alice some predictions first
      for (let i = 0; i < 10; i++) {
        await registry.manualUpdate(alice.address, "crypto", true, 0n, 4000, 8000);
      }

      const before = (await registry.getProfile(alice.address)).compositeScore;

      // Advance past the current 1000-block epoch so alice appears inactive
      await mine(1001);

      // Decay (called by owner)
      await registry.applyDecay(alice.address);

      const after = (await registry.getProfile(alice.address)).compositeScore;
      // After should be 98% of before
      expect(after).to.equal((before * 98n) / 100n);
    });

    it("does nothing to wallet with no predictions", async function () {
      await registry.applyDecay(alice.address); // should not revert
      const p = await registry.getProfile(alice.address);
      expect(p.compositeScore).to.equal(0n);
    });
  });

  describe("getters", function () {
    it("getPredictors returns paginated results", async function () {
      await registry.manualUpdate(alice.address, "crypto", true, 0n, 5000, 7000);
      await registry.manualUpdate(bob.address, "crypto", true, 0n, 5000, 7000);

      const page = await registry.getPredictors(0, 2);
      expect(page.length).to.equal(2);
      expect(page).to.include(alice.address);
      expect(page).to.include(bob.address);
    });
  });
});
