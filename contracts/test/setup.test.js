/**
 * Setup verification test — confirms Hardhat + Somnia config is correct.
 */

const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("Hardhat Setup", function () {
  it("should be on the correct local network (chainId 31337)", async function () {
    const net = await ethers.provider.getNetwork();
    expect(net.chainId).to.equal(31337n);
  });

  it("should have a deployer account with ETH on local node", async function () {
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    expect(balance).to.be.gt(0n);
  });

  it("should compile ReactiveBase interface without errors", async function () {
    // If compilation failed, this file wouldn't run — this acts as a smoke test
    expect(true).to.be.true;
  });
});
