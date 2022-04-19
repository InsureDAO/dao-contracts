const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("DevFeeForwarder", () => {
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
    const Distributor = await ethers.getContractFactory("DevFeeForwarder");

    token = await Token.deploy(name, symbol, decimal);
    dstr = await Distributor.deploy(alice.address);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("Condition", function () {
    it("contract should be deployed", async () => {
      expect(await token.address).to.exist;
      expect(await dstr.address).to.exist;
      expect(await dstr.wallet()).to.equal(alice.address);
    });
  });

  describe("constructor()", function () {
    it("deploy should be reverted", async () => {
      const Distributor = await ethers.getContractFactory("DevFeeForwarder");
      await expect(Distributor.deploy(ZERO_ADDRESS)).to.revertedWith("zero address");
    });
  });

  describe("distribute()", function () {
    it("test_distribute_success", async () => {
      await token._mint_for_testing(1000);
      await token.approve(dstr.address, 1000);

      //creator has 1000, and approve 1000 to the dstr
      expect(await token.balanceOf(creator.address)).to.equal(1000);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(1000);
      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(0);

      await dstr.distribute(token.address);

      expect(await token.balanceOf(creator.address)).to.equal(0);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(1000);
    });

    it("test_distribute_success_all_token", async () => {
      await token._mint_for_testing(1500);
      await token.approve(dstr.address, 1000);
      await token.transfer(dstr.address, 500);

      //creator has 1000, and approve 1000 to the dstr
      expect(await token.balanceOf(creator.address)).to.equal(1000);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(1000);
      expect(await token.balanceOf(dstr.address)).to.equal(500);
      expect(await token.balanceOf(alice.address)).to.equal(0);

      await dstr.distribute(token.address);

      expect(await token.balanceOf(creator.address)).to.equal(0);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(1500);
    });

    it("test_distribute_success_no_claimable", async () => {
      await token._mint_for_testing(1000);
      await token.approve(dstr.address, 0);
      await token.transfer(dstr.address, 500);

      //creator has 1000, and approve 1000 to the dstr
      expect(await token.balanceOf(creator.address)).to.equal(500);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await token.balanceOf(dstr.address)).to.equal(500);
      expect(await token.balanceOf(alice.address)).to.equal(0);

      await dstr.distribute(token.address);

      expect(await token.balanceOf(creator.address)).to.equal(500);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(500);
    });

    it("test_distribute_fail", async () => {
      await expect(dstr.distribute(ZERO_ADDRESS)).to.revertedWith("zero address");
    });
  });
});
