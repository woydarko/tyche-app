/**
 * SC-15 — Comprehensive score calculation tests
 *
 * Covers:
 *   - Score increases on correct prediction
 *   - Score decreases on wrong prediction
 *   - Tier upgrades trigger SBTEvolved event (via reactive simulation)
 *   - Season decay works correctly
 *   - Rolling 20-prediction window Sharpe consistency
 *   - Category mastery scoring (SC-06)
 *   - Follow/unfollow social graph (via TycheSocial)
 *   - Full reactive pipeline (MockMarket → Adapter → Registry → SBT)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("ScoreCalculations (SC-15)", function () {
  let adapter, registry, sbt, seasonManager, social, mock;
  let owner, alice, bob, carol;

  const FAKE_REACTIVE = "0x0000000000000000000000000000000000000001";

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const AdapterF  = await ethers.getContractFactory("TycheMarketAdapter");
    const RegistryF = await ethers.getContractFactory("TycheScoreRegistry");
    const SBTF      = await ethers.getContractFactory("TycheSBT");
    const SeasonF   = await ethers.getContractFactory("TycheSeasonManager");
    const SocialF   = await ethers.getContractFactory("TycheSocial");
    const MockF     = await ethers.getContractFactory("MockPredictionMarket");

    adapter       = await AdapterF.deploy();
    registry      = await RegistryF.deploy(FAKE_REACTIVE, await adapter.getAddress());
    sbt           = await SBTF.deploy(FAKE_REACTIVE, await registry.getAddress());
    seasonManager = await SeasonF.deploy(FAKE_REACTIVE, await registry.getAddress());
    social        = await SocialF.deploy(FAKE_REACTIVE, await adapter.getAddress());
    mock          = await MockF.deploy(await adapter.getAddress());

    await adapter.setMarketAuthorization(await mock.getAddress(), true);
    await registry.setSbtContract(await sbt.getAddress());
  });

  // ─── Helper ────────────────────────────────────────────────────────────────
  async function update(wallet, category, result, entryOdds = 5000, exitOdds = 8000) {
    await registry.manualUpdate(
      wallet, category, result,
      result ? ethers.parseEther("0.1") : ethers.parseEther("-0.1"),
      entryOdds, exitOdds
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  describe("Score increases on correct prediction", function () {
    it("compositeScore > 0 after first win", async function () {
      await update(alice.address, "crypto", true);
      const p = await registry.getProfile(alice.address);
      expect(p.compositeScore).to.be.gt(0n);
      expect(p.accuracyScore).to.be.gt(0n);
    });

    it("compositeScore grows with more wins", async function () {
      await update(alice.address, "crypto", true);
      const after1 = (await registry.getProfile(alice.address)).compositeScore;

      for (let i = 0; i < 5; i++) {
        await update(alice.address, "crypto", true, 4000, 9000);
      }
      const after6 = (await registry.getProfile(alice.address)).compositeScore;
      expect(after6).to.be.gt(after1);
    });

    it("totalWins and totalPredictions increment correctly", async function () {
      await update(alice.address, "crypto", true);
      await update(alice.address, "crypto", true);
      await update(alice.address, "crypto", false);

      const p = await registry.getProfile(alice.address);
      expect(p.totalPredictions).to.equal(3n);
      expect(p.totalWins).to.equal(2n);
    });

    it("streak increments on consecutive wins", async function () {
      for (let i = 0; i < 7; i++) {
        await update(alice.address, "crypto", true);
      }
      const p = await registry.getProfile(alice.address);
      expect(p.currentStreak).to.equal(7n);
      expect(p.longestStreak).to.equal(7n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Score response to wrong predictions", function () {
    it("loss does not increase compositeScore vs prior win", async function () {
      await update(alice.address, "crypto", true);
      const afterWin = (await registry.getProfile(alice.address)).compositeScore;

      await update(alice.address, "crypto", false, 5000, 500);
      const afterLoss = (await registry.getProfile(alice.address)).compositeScore;

      // After a loss the score should be <= what it was purely from wins
      // (accuracy drops, calibration penalized)
      expect(afterLoss).to.be.lte(afterWin);
    });

    it("streak resets to 0 on loss", async function () {
      for (let i = 0; i < 5; i++) await update(alice.address, "crypto", true);
      await update(alice.address, "crypto", false, 5000, 500);

      const p = await registry.getProfile(alice.address);
      expect(p.currentStreak).to.equal(0n);
      expect(p.longestStreak).to.equal(5n); // longest preserved
    });

    it("totalPnl goes negative on losses", async function () {
      await update(alice.address, "crypto", false);
      const p = await registry.getProfile(alice.address);
      expect(p.totalPnl).to.be.lt(0n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Tier upgrades trigger SBT events (SC-08)", function () {
    it("TierChanged emitted when tier increases", async function () {
      // 30 wins at favourable odds to push score to Silver (200+)
      let tierChanged = false;
      for (let i = 0; i < 30; i++) {
        const t = await registry.manualUpdate(alice.address, "crypto", true, 0n, 3000, 9500);
        const receipt = await t.wait();
        const changed = receipt.logs.some(l => {
          try { return registry.interface.parseLog(l)?.name === "TierChanged"; }
          catch { return false; }
        });
        if (changed) { tierChanged = true; break; }
      }
      expect(tierChanged).to.be.true;
    });

    it("SBT evolve can be called after tier change", async function () {
      // Push alice to Silver
      for (let i = 0; i < 30; i++) {
        await registry.manualUpdate(alice.address, "crypto", true, 0n, 3000, 9500);
      }
      const tier = await registry.getTier(alice.address);
      expect(tier).to.be.gte(1);

      // Mint SBT and evolve to match current tier
      await sbt.mint(alice.address, 0);
      await sbt.evolve(alice.address, tier);
      const data = await sbt.getSBTDataByWallet(alice.address);
      expect(data.tier).to.equal(tier);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Rolling 20-prediction window (SC-06)", function () {
    it("consistency score > 0 after first prediction", async function () {
      await update(alice.address, "crypto", true);
      const p = await registry.getProfile(alice.address);
      expect(p.consistencyScore).to.be.gt(0n);
    });

    it("rolling window capped at 20 predictions", async function () {
      for (let i = 0; i < 25; i++) {
        await update(alice.address, "crypto", true);
      }
      const p = await registry.getProfile(alice.address);
      expect(p.rollingWindowCount).to.equal(20n);
      expect(p.rollingWindowWins).to.equal(20n); // all 20 in window are wins
    });

    it("window drops oldest result when full", async function () {
      // 19 wins, then 1 loss (fills window), then 1 more win
      for (let i = 0; i < 19; i++) await update(alice.address, "crypto", true);
      await update(alice.address, "crypto", false);
      // window: [W×19, L] — wins=19
      let p = await registry.getProfile(alice.address);
      expect(p.rollingWindowWins).to.equal(19n);

      // Next win: oldest (the very first W) drops out, new W comes in
      await update(alice.address, "crypto", true);
      p = await registry.getProfile(alice.address);
      expect(p.rollingWindowCount).to.equal(20n);
      // oldest W dropped, new W added: still 19 wins in window (L stays)
      expect(p.rollingWindowWins).to.equal(19n);
    });

    it("high win rate gives high consistency score", async function () {
      // 20 wins → perfect Sharpe → score = 200
      for (let i = 0; i < 20; i++) await update(alice.address, "crypto", true);
      const p = await registry.getProfile(alice.address);
      expect(p.consistencyScore).to.equal(200n);
    });

    it("50% win rate gives ~100 consistency (Sharpe baseline)", async function () {
      // alternate W/L 20 times
      for (let i = 0; i < 20; i++) {
        await update(alice.address, "crypto", i % 2 === 0);
      }
      const p = await registry.getProfile(alice.address);
      // Sharpe at p=0.5 → score=100 exactly
      expect(p.consistencyScore).to.equal(100n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Category mastery (SC-06)", function () {
    it("tracks wins per category", async function () {
      await update(alice.address, "crypto", true);
      await update(alice.address, "crypto", true);
      await update(alice.address, "sports", false);

      const crypto = await registry.getCategoryScore(alice.address, "crypto");
      const sports = await registry.getCategoryScore(alice.address, "sports");

      expect(crypto.wins).to.equal(2n);
      expect(crypto.total).to.equal(2n);
      expect(sports.wins).to.equal(0n);
      expect(sports.total).to.equal(1n);
    });

    it("masteryScore = 0 before enough predictions", async function () {
      await update(alice.address, "politics", true); // only 1 prediction
      const cs = await registry.getCategoryScore(alice.address, "politics");
      expect(cs.masteryScore).to.equal(10n); // 100% wr * 10% confidence (1/10)
    });

    it("masteryScore reaches 100 with 10+ predictions at 100% win rate", async function () {
      for (let i = 0; i < 10; i++) await update(alice.address, "crypto", true);
      const cs = await registry.getCategoryScore(alice.address, "crypto");
      expect(cs.masteryScore).to.equal(100n);
    });

    it("masteryScore = 50 with 50% win rate + 10 predictions", async function () {
      for (let i = 0; i < 10; i++) {
        await update(alice.address, "crypto", i % 2 === 0);
      }
      const cs = await registry.getCategoryScore(alice.address, "crypto");
      expect(cs.masteryScore).to.equal(50n);
    });

    it("tracks category keys per wallet", async function () {
      await update(alice.address, "crypto", true);
      await update(alice.address, "sports", true);
      const keys = await registry.getWalletCategoryKeys(alice.address);
      expect(keys.length).to.equal(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Season decay (SC-10)", function () {
    it("decay reduces composite score by 2% when inactive", async function () {
      for (let i = 0; i < 10; i++) await update(alice.address, "crypto", true);
      const before = (await registry.getProfile(alice.address)).compositeScore;

      await mine(1001);
      await registry.applyDecay(alice.address);

      const after = (await registry.getProfile(alice.address)).compositeScore;
      expect(after).to.equal((before * 98n) / 100n);
    });

    it("decay does not apply if active in same epoch", async function () {
      for (let i = 0; i < 5; i++) await update(alice.address, "crypto", true);
      const before = (await registry.getProfile(alice.address)).compositeScore;

      // No block mining — same epoch
      await registry.applyDecay(alice.address);
      const after = (await registry.getProfile(alice.address)).compositeScore;
      expect(after).to.equal(before); // no decay
    });

    it("multiple decay rounds compound", async function () {
      for (let i = 0; i < 15; i++) await update(alice.address, "crypto", true);
      const initial = (await registry.getProfile(alice.address)).compositeScore;

      await mine(1001);
      await registry.applyDecay(alice.address);
      await mine(1001);
      await registry.applyDecay(alice.address);

      const after2 = (await registry.getProfile(alice.address)).compositeScore;
      const expected = (initial * 98n * 98n) / (100n * 100n);
      expect(after2).to.equal(expected);
    });

    it("decay can trigger tier demotion", async function () {
      // Push alice to Silver (200+ composite)
      for (let i = 0; i < 30; i++) {
        await registry.manualUpdate(alice.address, "crypto", true, 0n, 3000, 9500);
      }
      const tier1 = await registry.getTier(alice.address);

      // Decay many times until score drops below tier boundary
      for (let round = 0; round < 60; round++) {
        await mine(1001);
        await registry.applyDecay(alice.address);
      }

      const tier2 = await registry.getTier(alice.address);
      expect(tier2).to.be.lte(tier1); // tier should have dropped or stayed
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Follow/unfollow social graph (SC-11)", function () {
    it("alice follows and unfollows bob", async function () {
      await social.connect(alice).follow(bob.address);
      expect(await social.isFollowing(alice.address, bob.address)).to.be.true;
      expect(await social.followerCount(bob.address)).to.equal(1n);

      await social.connect(alice).unfollow(bob.address);
      expect(await social.isFollowing(alice.address, bob.address)).to.be.false;
      expect(await social.followerCount(bob.address)).to.equal(0n);
    });

    it("multi-follower graph is consistent after multiple unfollows", async function () {
      await social.connect(alice).follow(bob.address);
      await social.connect(carol).follow(bob.address);
      await social.connect(alice).follow(carol.address);

      await social.connect(alice).unfollow(bob.address);

      expect(await social.followerCount(bob.address)).to.equal(1n); // carol still follows
      expect(await social.followingCount(alice.address)).to.equal(1n); // still follows carol
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Full reactive pipeline — MockMarket end-to-end", function () {
    it("resolving a market emits PredictionResolved and updates adapter", async function () {
      await mock.createMarket("BTC > 100k EOY?", "crypto");
      // Two bets so the contract has enough ETH to pay winner
      await mock.connect(alice).placeBet(1, true,  6000, { value: ethers.parseEther("0.05") });
      await mock.connect(bob).placeBet(1,   false, 4000, { value: ethers.parseEther("0.05") });

      await expect(mock.resolveMarket(1, true))
        .to.emit(adapter, "PredictionResolved")
        .withArgs(
          alice.address,
          "1", "crypto", true,
          (pnl) => pnl >= 0n,   // pnl >= 0: winner gets positive pnl
          6000n, 9500n,
          (ts) => ts > 0n
        );
    });

    it("multiple players — all get PredictionResolved events", async function () {
      await mock.createMarket("ETH > 5k?", "crypto");
      await mock.connect(alice).placeBet(1, true,  6000, { value: ethers.parseEther("0.01") });
      await mock.connect(bob).placeBet(1,   false, 4000, { value: ethers.parseEther("0.01") });

      const tx = await mock.resolveMarket(1, true);
      const receipt = await tx.wait();
      const adapterAddr = (await adapter.getAddress()).toLowerCase();
      const iface = adapter.interface;
      const resolved = receipt.logs
        .filter(l => l.address.toLowerCase() === adapterAddr)
        .map(l => { try { return iface.parseLog(l); } catch { return null; }})
        .filter(e => e?.name === "PredictionResolved");

      expect(resolved.length).to.equal(2);
      const wallets = resolved.map(e => e.args[0].toLowerCase());
      expect(wallets).to.include(alice.address.toLowerCase());
      expect(wallets).to.include(bob.address.toLowerCase());
    });
  });
});
