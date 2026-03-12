const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockPredictionMarket", function () {
  let adapter, mock, owner, alice, bob;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const AdapterF = await ethers.getContractFactory("TycheMarketAdapter");
    adapter = await AdapterF.deploy();

    const MockF = await ethers.getContractFactory("MockPredictionMarket");
    mock = await MockF.deploy(await adapter.getAddress());

    // Authorize mock to report to adapter
    await adapter.setMarketAuthorization(await mock.getAddress(), true);
  });

  describe("createMarket", function () {
    it("creates a market and emits event", async function () {
      await expect(mock.createMarket("Will BTC hit $100k?", "crypto"))
        .to.emit(mock, "MarketCreated")
        .withArgs(1n, "Will BTC hit $100k?", "crypto");

      const m = await mock.getMarket(1);
      expect(m.id).to.equal(1n);
      expect(m.title).to.equal("Will BTC hit $100k?");
      expect(m.state).to.equal(0); // Open
    });

    it("only owner can create market", async function () {
      await expect(
        mock.connect(alice).createMarket("test", "crypto")
      ).to.be.reverted;
    });
  });

  describe("placeBet", function () {
    beforeEach(async function () {
      await mock.createMarket("Will ETH flip BTC?", "crypto");
    });

    it("places a bet and emits event", async function () {
      await expect(
        mock.connect(alice).placeBet(1, true, 4000, { value: ethers.parseEther("0.01") })
      )
        .to.emit(mock, "BetPlaced")
        .withArgs(1n, alice.address, true, 4000n, ethers.parseEther("0.01"));
    });

    it("rejects bet on closed market", async function () {
      await mock.connect(alice).placeBet(1, true, 5000, { value: ethers.parseEther("0.01") });
      await mock.resolveMarket(1, true);

      await expect(
        mock.connect(bob).placeBet(1, false, 5000, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("MockPredictionMarket: market closed");
    });

    it("rejects invalid odds", async function () {
      await expect(
        mock.connect(alice).placeBet(1, true, 9999, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("MockPredictionMarket: invalid odds");
    });

    it("rejects zero amount", async function () {
      await expect(
        mock.connect(alice).placeBet(1, true, 5000, { value: 0 })
      ).to.be.revertedWith("MockPredictionMarket: bet amount required");
    });
  });

  describe("resolveMarket", function () {
    beforeEach(async function () {
      await mock.createMarket("Will Somnia launch mainnet?", "crypto");
    });

    it("resolves market, settles bets, and reports to adapter", async function () {
      await mock.connect(alice).placeBet(1, true, 6000, { value: ethers.parseEther("0.01") });
      await mock.connect(bob).placeBet(1, false, 4000, { value: ethers.parseEther("0.01") });

      // YES wins → alice wins, bob loses
      await expect(mock.resolveMarket(1, true))
        .to.emit(mock, "MarketResolved").withArgs(1n, true)
        .and.to.emit(adapter, "PredictionResolved"); // triggered for each bet

      const m = await mock.getMarket(1);
      expect(m.state).to.equal(1); // Resolved
      expect(m.outcome).to.be.true;
    });

    it("only owner can resolve", async function () {
      await expect(mock.connect(alice).resolveMarket(1, true)).to.be.reverted;
    });

    it("cannot resolve twice", async function () {
      await mock.resolveMarket(1, true);
      await expect(mock.resolveMarket(1, false)).to.be.revertedWith(
        "MockPredictionMarket: already resolved"
      );
    });
  });

  describe("integration — full pipeline", function () {
    it("emits PredictionResolved for each settled bet", async function () {
      await mock.createMarket("Will gas fees drop?", "crypto");

      await mock.connect(alice).placeBet(1, true,  7000, { value: ethers.parseEther("0.05") });
      await mock.connect(alice).placeBet(1, false, 3000, { value: ethers.parseEther("0.02") });
      await mock.connect(bob).placeBet(1,   true,  6000, { value: ethers.parseEther("0.01") });

      // Count PredictionResolved events
      const tx = await mock.resolveMarket(1, true);
      const receipt = await tx.wait();
      const iface = adapter.interface;
      const adapterAddr = (await adapter.getAddress()).toLowerCase();
      const resolvedEvents = receipt.logs
        .filter(l => l.address.toLowerCase() === adapterAddr)
        .map(l => { try { return iface.parseLog(l); } catch { return null; }})
        .filter(e => e && e.name === "PredictionResolved");

      expect(resolvedEvents.length).to.equal(3); // one per bet
    });
  });
});
