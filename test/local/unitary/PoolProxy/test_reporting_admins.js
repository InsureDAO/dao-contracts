const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("PoolProxy", () => {
  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;
  const INITIAL_SUPPLY = 1303030303000000000000000000;

  before(async () => {
    //import
    [creator, alice, bob] = await ethers.getSigners();
    const PoolProxy = await ethers.getContractFactory("PoolProxy");

    //deploy
    pool_proxy = await PoolProxy.deploy(creator.address, alice.address, bob.address);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("Condition", function () {
    it("contract should be deployed", async () => {
      expect(pool_proxy.address).to.exist;
    });
  });

  describe("Admin Check", function () {
    it("", async () => {});

    it("test_admin_for_multiple_pools", async () => {});
  });
});
