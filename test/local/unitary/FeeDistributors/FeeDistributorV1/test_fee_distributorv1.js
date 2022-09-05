const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("FeeDistributorV1", () => {
  const name = "Fee Token";
  const symbol = "FT";
  const decimal = 18;
  const rpt_decimal = 0;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const FEE = BigNumber.from("1000000");

  before(async () => {
    [creator, alice, bob, chad, dad] = await ethers.getSigners();
    addresses = [creator.address, alice.address, bob.address, chad.address, dad.address];
    const Token = await ethers.getContractFactory("TestToken");
    const Converter = await ethers.getContractFactory("TestConverter");
    const Distributor = await ethers.getContractFactory("FeeDistributorV1");

    insure = await Token.deploy(name, symbol, decimal);
    token = await Token.deploy(name, symbol, decimal);
    converter = await Converter.deploy(insure.address);
    dstr = await Distributor.deploy(insure.address, converter.address);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("Condition", function () {
    it("contract should be deployed", async () => {
      await expect(insure.address).to.exist;
      await expect(converter.address).to.exist;
      await expect(dstr.address).to.exist;
    });
  });

  describe("constructor()", function () {
    it("deploy should be reverted", async () => {
      const Distributor = await ethers.getContractFactory("FeeDistributorV1");
      await expect(Distributor.deploy(ZERO_ADDRESS, converter.address)).to.revertedWith("zero-address");
      await expect(Distributor.deploy(insure.address, ZERO_ADDRESS)).to.revertedWith("zero-address");
    });
  });

  describe("distribute()", function () {
    it("test_distribute_success", async () => {
      await insure._mint_for_testing(1000);
      await insure.approve(dstr.address, 1000);

      //creator has 1000, and approve 1000 to the dstr
      expect(await insure.balanceOf(creator.address)).to.equal(1000);
      expect(await insure.allowance(creator.address, dstr.address)).to.equal(1000);
      expect(await insure.balanceOf(dstr.address)).to.equal(0);

      await dstr.distribute(insure.address);

      expect(await insure.balanceOf(creator.address)).to.equal(0);
      expect(await insure.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await insure.balanceOf(dstr.address)).to.equal(0);
    });

    it("test_distribute_burn_all_token", async () => {
      await insure._mint_for_testing(1500);
      await insure.approve(dstr.address, 1000);

      //send 500 directly
      await insure.transfer(dstr.address, 500);

      //creator:1000, approve:1000. dstr:500
      expect(await insure.balanceOf(creator.address)).to.equal(1000);
      expect(await insure.allowance(creator.address, dstr.address)).to.equal(1000);
      expect(await insure.balanceOf(dstr.address)).to.equal(500);

      await dstr.distribute(insure.address);

      expect(await insure.balanceOf(creator.address)).to.equal(0);
      expect(await insure.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await insure.balanceOf(dstr.address)).to.equal(0);
    });

    it("test_distribute_burn_other_token", async () => {
      await token._mint_for_testing(1000);

      //send 1000 directly
      await token.transfer(dstr.address, 1000);

      //creator:0, approve:0. dstr:1000
      expect(await token.balanceOf(creator.address)).to.equal(0);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await token.balanceOf(dstr.address)).to.equal(1000);

      await dstr.distribute(token.address);

      //all gone
      expect(await insure.balanceOf(creator.address)).to.equal(0);
      expect(await insure.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await insure.balanceOf(dstr.address)).to.equal(0);
    });

    it("test_distribute_fail_1", async () => {
      await insure._mint_for_testing(1000);

      //creator has 1000, and approve 1000 to the dstr
      expect(await insure.balanceOf(creator.address)).to.equal(1000);
      expect(await insure.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await insure.balanceOf(dstr.address)).to.equal(0);

      await expect(dstr.distribute(insure.address)).to.revertedWith("no distributable amount");
    });
  });
});
