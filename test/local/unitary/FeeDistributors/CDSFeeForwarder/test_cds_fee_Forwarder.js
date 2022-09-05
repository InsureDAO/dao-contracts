const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

console.log = function () {};

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
    const Distributor = await ethers.getContractFactory("CDSFeeForwarder");

    token = await Token.deploy(name, symbol, decimal);
    dstr = await Distributor.deploy(token.address, alice.address);
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
      expect(await dstr.recipient()).to.equal(alice.address);
    });
  });

  describe("constructor()", function () {
    it("deploy should be reverted", async () => {
      const Distributor = await ethers.getContractFactory("CDSFeeForwarder");
      await expect(Distributor.deploy(ZERO_ADDRESS, alice.address)).to.revertedWith("zero address");
    });

    it("deploy should be reverted 2", async () => {
      const Distributor = await ethers.getContractFactory("CDSFeeForwarder");
      await expect(Distributor.deploy(token.address, ZERO_ADDRESS)).to.revertedWith("zero address");
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

      await dstr.distribute();

      expect(await token.balanceOf(creator.address)).to.equal(0);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(1000);
    });

    it("test_distribute_success_zero_amount", async () => {
      //creator has 1000, and approve 1000 to the dstr
      expect(await token.balanceOf(creator.address)).to.equal(0);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(0);

      await dstr.distribute();

      expect(await token.balanceOf(creator.address)).to.equal(0);
      expect(await token.allowance(creator.address, dstr.address)).to.equal(0);
      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(0);
    });

    it("test_distribute_success_no_claimable", async () => {
      await token._mint_for_testing(1000);
      await token.approve(dstr.address, 0);

      expect(await token.allowance(creator.address, dstr.address)).to.equal(0);

      await dstr.distribute();
    });
  });

  describe("salvage()", function () {
    it("test_salvage_success", async () => {
      await token._mint_for_testing(1000);
      await token.transfer(dstr.address, 1000);

      //creator has 1000, and approve 1000 to the dstr
      expect(await token.balanceOf(dstr.address)).to.equal(1000);
      expect(await token.balanceOf(alice.address)).to.equal(0);

      await dstr.salvage(token.address, alice.address);

      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(1000);
    });

    it("test_salvage_success_zero_amount", async () => {
      //creator has 1000, and approve 1000 to the dstr
      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(0);

      await dstr.salvage(token.address, alice.address);

      expect(await token.balanceOf(dstr.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(0);
    });

    it("test_distribute_success_no_claimable", async () => {
      await expect(dstr.salvage(ZERO_ADDRESS, alice.address)).to.revertedWith("zero address");
    });
  });
});
