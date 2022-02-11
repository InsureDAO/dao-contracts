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
    const simbol = "Insure";
    const decimal = 18;
    const INITIAL_SUPPLY = BigNumber.from("126000000000000000000000000");
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const YEAR = BigNumber.from(86400 * 365);
    const WEEK = BigNumber.from(86400 * 7);

    before(async () => {
      [creator, alice, bob] = await ethers.getSigners();
      const Token = await ethers.getContractFactory("InsureToken");
      Insure = await Token.deploy(name, simbol);
    });

    beforeEach(async () => {
      snapshotId = await snapshot();
    });

    afterEach(async () => {
      await restore(snapshotId);
    });

    //revert test
    it("test_set_minter_admin_only", async () => {
      await expect(
        Insure.connect(alice).set_minter(bob.address)
      ).to.revertedWith("dev: admin only");
    });

    it("test_set_admin_admin_only", async () => {
      await expect(
        Insure.connect(alice).set_admin(bob.address)
      ).to.revertedWith("dev: admin only");
    });

    it("test_set_name_admin_only", async () => {
      await expect(
        Insure.connect(alice).set_name("Foo Token", "FOO")
      ).to.revertedWith("Only admin can change name");
    });

    //set test
    it("test_set_minter", async () => {
      await Insure.set_minter(alice.address); //from: creator
      expect(await Insure.minter()).to.equal(alice.address);
    });

    it("test_set_admin", async () => {
      await Insure.set_admin(alice.address); //from: creator
      expect(await Insure.admin()).to.equal(alice.address);
    });

    it("test_set_name", async () => {
      await Insure.set_name("Foo Token", "FOO"); //from: creator
      expect(await Insure.name()).to.equal("Foo Token");
      expect(await Insure.symbol()).to.equal("FOO");
    });
  });
});
