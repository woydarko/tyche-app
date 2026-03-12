const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("TycheSeasonManager", function () {
  let adapter, registry, seasonManager, owner, alice, bob;
  const FAKE_REACTIVE_SERVICE = "0x0000000000000000000000000000000000000001";

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const AdapterF  = await ethers.getContractFactory("TycheMarketAdapter");
    const RegistryF = await ethers.getContractFactory("TycheScoreRegistry");
    const SeasonF   = await ethers.getContractFactory("TycheSeasonManager");

    adapter       = await AdapterF.deploy();
    registry      = await RegistryF.deploy(FAKE_REACTIVE_SERVICE, await adapter.getAddress());
    seasonManager = await SeasonF.deploy(FAKE_REACTIVE_SERVICE, await registry.getAddress());
  });

  describe("startSeason", function () {
    it("creates a new season", async function () {
      await expect(seasonManager.startSeason(0))
        .to.emit(seasonManager, "SeasonStarted")
        .withArgs(1n, (s) => s > 0n, (e) => e > 0n);

      expect(await seasonManager.currentSeasonId()).to.equal(1n);
    });

    it("only owner can start season", async function () {
      await expect(
        seasonManager.connect(alice).startSeason(0)
      ).to.be.reverted;
    });
  });

  describe("endSeason & top predictors", function () {
    it("records top predictors at season end", async function () {
      // Give alice and bob some scores
      await registry.manualUpdate(alice.address, "crypto", true, 0n, 4000, 8000);
      await registry.manualUpdate(alice.address, "crypto", true, 0n, 4000, 8000);
      await registry.manualUpdate(bob.address, "crypto", true, 0n, 6000, 9000);

      // Start season with very short duration (10 blocks)
      await seasonManager.startSeason(10);
      // Mine past the end
      await mine(11);

      await seasonManager.endSeason();

      const [wallets, scores] = await seasonManager.getTopPredictors(1);
      // Top predictors should include alice and bob
      const nonZero = wallets.filter(w => w !== ethers.ZeroAddress);
      expect(nonZero.length).to.be.gte(1);
    });

    it("cannot end season before endBlock", async function () {
      await seasonManager.startSeason(1000);
      await expect(seasonManager.endSeason()).to.be.revertedWith(
        "TycheSeasonManager: season not ended"
      );
    });

    it("cannot end an already finalized season", async function () {
      await seasonManager.startSeason(5);
      await mine(6);
      await seasonManager.endSeason();
      await expect(seasonManager.endSeason()).to.be.revertedWith(
        "TycheSeasonManager: already finalized"
      );
    });
  });

  describe("getCurrentSeason", function () {
    it("returns current season info", async function () {
      await seasonManager.startSeason(500);
      const s = await seasonManager.getCurrentSeason();
      expect(s.id).to.equal(1n);
      expect(s.finalized).to.be.false;
    });
  });
});
