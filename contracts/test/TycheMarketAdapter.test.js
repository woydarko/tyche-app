const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TycheMarketAdapter", function () {
  let adapter, owner, market, other;

  beforeEach(async function () {
    [owner, market, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TycheMarketAdapter");
    adapter = await Factory.deploy();
  });

  describe("Authorization", function () {
    it("owner can authorize a market", async function () {
      await adapter.setMarketAuthorization(market.address, true);
      expect(await adapter.authorizedMarkets(market.address)).to.be.true;
    });

    it("non-owner cannot authorize", async function () {
      await expect(
        adapter.connect(other).setMarketAuthorization(market.address, true)
      ).to.be.reverted;
    });

    it("can revoke authorization", async function () {
      await adapter.setMarketAuthorization(market.address, true);
      await adapter.setMarketAuthorization(market.address, false);
      expect(await adapter.authorizedMarkets(market.address)).to.be.false;
    });
  });

  describe("reportResolution", function () {
    beforeEach(async function () {
      await adapter.setMarketAuthorization(market.address, true);
    });

    it("authorized market can report resolution", async function () {
      await expect(
        adapter.connect(market).reportResolution(
          other.address,
          "MOCK-1",
          "crypto",
          true,
          ethers.parseEther("0.1"),
          6000,  // 60% entryOdds
          9000   // 90% exitOdds
        )
      ).to.emit(adapter, "PredictionResolved").withArgs(
        other.address,
        "MOCK-1",
        "crypto",
        true,
        ethers.parseEther("0.1"),
        6000,
        9000,
        (ts) => ts > 0n
      );
    });

    it("owner can report directly without market authorization", async function () {
      await expect(
        adapter.reportResolution(
          other.address, "MOCK-2", "sports", false,
          ethers.parseEther("-0.05"), 7000, 500
        )
      ).to.emit(adapter, "PredictionResolved");
    });

    it("unauthorized caller reverts", async function () {
      await expect(
        adapter.connect(other).reportResolution(
          other.address, "MOCK-3", "crypto", true, 0n, 5000, 5000
        )
      ).to.be.revertedWith("TycheMarketAdapter: caller not authorized");
    });

    it("rejects zero address wallet", async function () {
      await expect(
        adapter.reportResolution(
          ethers.ZeroAddress, "MOCK-4", "crypto", true, 0n, 5000, 5000
        )
      ).to.be.revertedWith("TycheMarketAdapter: zero address");
    });

    it("rejects invalid entryOdds", async function () {
      await expect(
        adapter.reportResolution(other.address, "MOCK-5", "crypto", true, 0n, 0, 5000)
      ).to.be.revertedWith("TycheMarketAdapter: invalid entryOdds");

      await expect(
        adapter.reportResolution(other.address, "MOCK-6", "crypto", true, 0n, 10001, 5000)
      ).to.be.revertedWith("TycheMarketAdapter: invalid entryOdds");
    });
  });
});
