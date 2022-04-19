const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("InsureToken", function () {
  describe("test_setters", function () {
    const name = "InsureToken";
    const symbol = "Insure";
    const decimal = 18;
    const INITIAL_SUPPLY = BigNumber.from("126000000000000000000000000");
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const YEAR = BigNumber.from(86400 * 365);
    const WEEK = BigNumber.from(86400 * 7);

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

    //revert test
    it("test_set_minter_admin_only", async () => {
      await expect(Insure.connect(alice).set_minter(bob.address)).to.revertedWith("Caller is not allowed to operate");
    });

    it("test_set_name_admin_only", async () => {
      await expect(Insure.connect(alice).set_name("Foo Token", "FOO")).to.revertedWith(
        "Caller is not allowed to operate"
      );
    });

    //set test
    it("test_set_minter", async () => {
      await Insure.set_minter(alice.address); //from: creator
      expect(await Insure.minter()).to.equal(alice.address);
    });

    it("test_set_name", async () => {
      await Insure.set_name("Foo Token", "FOO"); //from: creator
      expect(await Insure.name()).to.equal("Foo Token");
      expect(await Insure.symbol()).to.equal("FOO");
    });

    describe("set_rate()", function () {
      it("revert when not admin", async () => {
        await expect(Insure.connect(alice).set_rate(0)).to.revertedWith("Caller is not allowed to operate");
      });

      it("set RATES[5] correctlly", async () => {
        let rate = BigNumber.from("2799999").mul("1000000000000000000").div(YEAR); //10**18

        await Insure.set_rate(rate);

        expect(await Insure.RATES(5)).to.equal(rate);
      });

      it("revert when same or equal", async () => {
        let rate = BigNumber.from("2800000").mul("1000000000000000000").div(YEAR); //10**18
        await expect(Insure.set_rate(rate)).to.revertedWith("Decrease Only");

        rate = BigNumber.from("2800001").mul("1000000000000000000").div(YEAR); //10**18
        await expect(Insure.set_rate(rate)).to.revertedWith("Decrease Only");
      });
    });
  });
});
