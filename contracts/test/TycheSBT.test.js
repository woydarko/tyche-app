const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TycheSBT", function () {
  let sbt, registry, owner, alice, bob;
  const FAKE_REACTIVE = "0x0000000000000000000000000000000000000001";

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const AdapterF  = await ethers.getContractFactory("TycheMarketAdapter");
    const RegistryF = await ethers.getContractFactory("TycheScoreRegistry");
    const SBTF      = await ethers.getContractFactory("TycheSBT");

    const adapter  = await AdapterF.deploy();
    registry = await RegistryF.deploy(FAKE_REACTIVE, await adapter.getAddress());
    sbt      = await SBTF.deploy(FAKE_REACTIVE, await registry.getAddress());
  });

  describe("ERC-5192 soulbound enforcement", function () {
    it("all tokens are locked (soulbound)", async function () {
      await sbt.mint(alice.address, 0);
      const tokenId = await sbt.tokenIdOf(alice.address);
      expect(await sbt.locked(tokenId)).to.be.true;
    });

    it("emits Locked event on mint", async function () {
      await expect(sbt.mint(alice.address, 0))
        .to.emit(sbt, "Locked");
    });

    it("locked() reverts for non-existent token", async function () {
      await expect(sbt.locked(999)).to.be.revertedWith("TycheSBT: token does not exist");
    });

    it("transfer is blocked (soulbound)", async function () {
      await sbt.mint(alice.address, 0);
      const tokenId = await sbt.tokenIdOf(alice.address);
      await expect(
        sbt.connect(alice).transferFrom(alice.address, bob.address, tokenId)
      ).to.be.revertedWith("TycheSBT: soulbound - transfers are disabled");
    });

    it("reports ERC-5192 interface support", async function () {
      // ERC-5192 interfaceId = 0xb45a3c0e
      expect(await sbt.supportsInterface("0xb45a3c0e")).to.be.true;
    });

    it("reports ERC-721 interface support", async function () {
      expect(await sbt.supportsInterface("0x80ac58cd")).to.be.true;
    });
  });

  describe("mint", function () {
    it("owner can mint SBT to wallet", async function () {
      await expect(sbt.mint(alice.address, 0))
        .to.emit(sbt, "SBTMinted")
        .withArgs(1n, alice.address, 0);

      expect(await sbt.ownerOf(1)).to.equal(alice.address);
      expect(await sbt.tokenIdOf(alice.address)).to.equal(1n);
    });

    it("cannot mint twice to same wallet", async function () {
      await sbt.mint(alice.address, 0);
      await expect(sbt.mint(alice.address, 1))
        .to.be.revertedWith("TycheSBT: wallet already has SBT");
    });

    it("cannot mint to zero address", async function () {
      await expect(sbt.mint(ethers.ZeroAddress, 0))
        .to.be.revertedWith("TycheSBT: zero address");
    });

    it("unauthorized caller cannot mint", async function () {
      await expect(sbt.connect(alice).mint(bob.address, 0))
        .to.be.revertedWith("TycheSBT: unauthorized minter");
    });

    it("tokenURI reflects tier", async function () {
      await sbt.mint(alice.address, 2); // Gold
      const uri = await sbt.tokenURI(1);
      expect(uri).to.equal("ipfs://QmTycheGold/metadata.json");
    });

    it("totalSupply increments on each mint", async function () {
      await sbt.mint(alice.address, 0);
      await sbt.mint(bob.address, 1);
      expect(await sbt.totalSupply()).to.equal(2n);
    });
  });

  describe("evolve", function () {
    beforeEach(async function () {
      await sbt.mint(alice.address, 0); // Bronze
    });

    it("owner can evolve SBT to higher tier", async function () {
      await expect(sbt.evolve(alice.address, 2))
        .to.emit(sbt, "SBTEvolved")
        .withArgs(1n, alice.address, 2, "ipfs://QmTycheGold/metadata.json");

      const data = await sbt.getSBTDataByWallet(alice.address);
      expect(data.tier).to.equal(2);
      expect(data.tokenURI).to.equal("ipfs://QmTycheGold/metadata.json");
    });

    it("evolve updates lastEvolutionBlock", async function () {
      const before = (await sbt.getSBTDataByWallet(alice.address)).lastEvolutionBlock;
      await sbt.evolve(alice.address, 1);
      const after = (await sbt.getSBTDataByWallet(alice.address)).lastEvolutionBlock;
      expect(after).to.be.gte(before);
    });

    it("reverts evolve on wallet with no SBT", async function () {
      await expect(sbt.evolve(bob.address, 1))
        .to.be.revertedWith("TycheSBT: wallet has no SBT");
    });

    it("unauthorized caller cannot evolve", async function () {
      await expect(sbt.connect(alice).evolve(alice.address, 1))
        .to.be.revertedWith("TycheSBT: unauthorized");
    });

    it("rejects invalid tier", async function () {
      await expect(sbt.evolve(alice.address, 5))
        .to.be.revertedWith("TycheSBT: invalid tier");
    });
  });

  describe("setTierBaseURI", function () {
    it("owner can update tier URI", async function () {
      await sbt.setTierBaseURI(4, "ipfs://NewOracleHash/metadata.json");
      await sbt.mint(alice.address, 4);
      expect(await sbt.tokenURI(1)).to.equal("ipfs://NewOracleHash/metadata.json");
    });

    it("non-owner cannot update tier URI", async function () {
      await expect(
        sbt.connect(alice).setTierBaseURI(0, "ipfs://fake/")
      ).to.be.reverted;
    });
  });
});
