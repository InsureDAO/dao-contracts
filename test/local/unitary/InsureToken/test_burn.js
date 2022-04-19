const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("InsureToken", () => {
  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;
  const INITIAL_SUPPLY = 126000000000000000000000000;

  before(async () => {
    [creator, alice, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("InsureToken");
    const Ownership = await ethers.getContractFactory("Ownership");

    ownership = await Ownership.deploy();
    Insure = await Token.deploy(name, symbol, ownership.address);
  });
  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("Condition", function () {
    it("contract should be deployed", async () => {
      expect(Insure.address).to.exist;
    });
  });

  describe("Constructor", function () {
    it("total_supply = 126000000000000000000000000", async () => {
      expect(await Insure.total_supply()).to.equal("126000000000000000000000000");
    });

    it("Creator should have 126000000000000000000000000", async () => {
      expect(await Insure.balanceOf(creator.address)).to.equal("126000000000000000000000000");
    });
  });

  describe("Burn", function () {
    it("Should burn token", async () => {
      let balance = BigNumber.from("126000000000000000000000000");
      let amount = BigNumber.from("31337");

      await Insure.burn(amount);
      expect(await Insure.balanceOf(creator.address)).to.equal(balance.sub(amount));
    });
  });

  describe("Burn_not_admin", function () {
    it("Should burn token", async () => {
      await Insure.transfer(alice.address, 1000000);

      let balance = BigNumber.from("126000000000000000000000000");
      amount = BigNumber.from("31337");

      await Insure.connect(alice).burn(amount);

      expect(await Insure.balanceOf(alice.address)).to.equal("968663");
      expect(await Insure.total_supply()).to.equal(balance.sub(amount));
    });
  });

  describe("Burn_All", function () {
    it("Should burn all token", async () => {
      let initial_supply = await Insure.total_supply();

      await Insure.burn(initial_supply);
      expect(await Insure.balanceOf(creator.address)).to.equal("0");
      expect(await Insure.total_supply()).to.equal("0");
    });
  });

  describe("Over_burn", function () {
    it("Should revert", async () => {
      let initial_supply = BigNumber.from(await Insure.total_supply());
      let amount = initial_supply.add("1");

      await expect(Insure.burn(amount)).to.revertedWith("_value > balanceOf[msg.sender]");
    });
  });
});
