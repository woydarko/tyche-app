const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TycheSocial", function () {
  let social, adapter, owner, alice, bob, carol;
  const FAKE_REACTIVE = "0x0000000000000000000000000000000000000001";

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const AdapterF = await ethers.getContractFactory("TycheMarketAdapter");
    const SocialF  = await ethers.getContractFactory("TycheSocial");

    adapter = await AdapterF.deploy();
    social  = await SocialF.deploy(FAKE_REACTIVE, await adapter.getAddress());
  });

  describe("follow", function () {
    it("alice can follow bob", async function () {
      await expect(social.connect(alice).follow(bob.address))
        .to.emit(social, "FollowCreated")
        .withArgs(alice.address, bob.address);

      expect(await social.isFollowing(alice.address, bob.address)).to.be.true;
    });

    it("followingCount and followerCount update", async function () {
      await social.connect(alice).follow(bob.address);
      await social.connect(carol).follow(bob.address);
      await social.connect(alice).follow(carol.address);

      expect(await social.followingCount(alice.address)).to.equal(2n);
      expect(await social.followerCount(bob.address)).to.equal(2n);
    });

    it("getFollowing returns correct list", async function () {
      await social.connect(alice).follow(bob.address);
      await social.connect(alice).follow(carol.address);

      const following = await social.getFollowing(alice.address);
      expect(following).to.include(bob.address);
      expect(following).to.include(carol.address);
    });

    it("getFollowers returns correct list", async function () {
      await social.connect(alice).follow(bob.address);
      await social.connect(carol).follow(bob.address);

      const followers = await social.getFollowers(bob.address);
      expect(followers).to.include(alice.address);
      expect(followers).to.include(carol.address);
    });

    it("cannot follow self", async function () {
      await expect(social.connect(alice).follow(alice.address))
        .to.be.revertedWith("TycheSocial: cannot follow self");
    });

    it("cannot follow zero address", async function () {
      await expect(social.connect(alice).follow(ethers.ZeroAddress))
        .to.be.revertedWith("TycheSocial: zero address");
    });

    it("cannot follow same wallet twice", async function () {
      await social.connect(alice).follow(bob.address);
      await expect(social.connect(alice).follow(bob.address))
        .to.be.revertedWith("TycheSocial: already following");
    });
  });

  describe("unfollow", function () {
    beforeEach(async function () {
      await social.connect(alice).follow(bob.address);
      await social.connect(alice).follow(carol.address);
      await social.connect(carol).follow(bob.address);
    });

    it("alice can unfollow bob", async function () {
      await expect(social.connect(alice).unfollow(bob.address))
        .to.emit(social, "FollowRemoved")
        .withArgs(alice.address, bob.address);

      expect(await social.isFollowing(alice.address, bob.address)).to.be.false;
      expect(await social.followingCount(alice.address)).to.equal(1n); // still following carol
    });

    it("follower count decrements after unfollow", async function () {
      await social.connect(alice).unfollow(bob.address);
      expect(await social.followerCount(bob.address)).to.equal(1n); // carol still follows
    });

    it("cannot unfollow someone not followed", async function () {
      await expect(social.connect(bob).unfollow(alice.address))
        .to.be.revertedWith("TycheSocial: not following");
    });

    it("can re-follow after unfollow", async function () {
      await social.connect(alice).unfollow(bob.address);
      await social.connect(alice).follow(bob.address);
      expect(await social.isFollowing(alice.address, bob.address)).to.be.true;
    });

    it("getFollowing is consistent after unfollows", async function () {
      await social.connect(alice).unfollow(bob.address);
      const following = await social.getFollowing(alice.address);
      expect(following).to.not.include(bob.address);
      expect(following).to.include(carol.address);
    });
  });

  describe("reactive PositionAlert", function () {
    it("emits PositionAlert to followers via reactive callback simulation", async function () {
      // Deploy social with owner as the reactive service so tests can call react()
      const SocialF   = await ethers.getContractFactory("TycheSocial");
      const AdapterF2 = await ethers.getContractFactory("TycheMarketAdapter");
      const adapter2  = await AdapterF2.deploy();
      // owner.address acts as the reactive service in tests
      const social2 = await SocialF.deploy(owner.address, await adapter2.getAddress());

      await social2.connect(alice).follow(bob.address);
      await social2.connect(carol).follow(bob.address);

      const walletTopic = BigInt(bob.address);
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "bool", "int256", "uint256", "uint256", "uint256"],
        ["1", "crypto", true, 0n, 6000n, 9000n, BigInt(Math.floor(Date.now() / 1000))]
      );

      const TOPIC0 = ethers.keccak256(
        ethers.toUtf8Bytes(
          "PredictionResolved(address,string,string,bool,int256,uint256,uint256,uint256)"
        )
      );

      // owner acts as the reactive service — calls react() to simulate Somnia callback
      await expect(
        social2.react(
          50312n,
          await adapter2.getAddress(),
          BigInt(TOPIC0),
          walletTopic,
          0n, 0n,
          data,
          BigInt(await ethers.provider.getBlockNumber()),
          0n
        )
      )
        .to.emit(social2, "PositionAlert").withArgs(alice.address, bob.address, "1", true)
        .and.to.emit(social2, "PositionAlert").withArgs(carol.address, bob.address, "1", true);
    });
  });
});
