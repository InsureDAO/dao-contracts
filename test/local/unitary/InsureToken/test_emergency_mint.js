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
  let owner;
  let Insure;
  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const DAY = 86400;
  const WEEK = 86400 * 7;
  const YEAR = 86400 * 365;

  before(async () => {
    [creator, alice, bob] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("InsureToken");
    const Ownership = await ethers.getContractFactory("Ownership");

    ownership = await Ownership.deploy();
    Insure = await Token.deploy(name, symbol, ownership.address);

    let latestBlock = await ethers.provider.getBlock("latest");
    let old_timestamp = latestBlock.timestamp;

    await ethers.provider.send("evm_increaseTime", [86401]);
    await Insure.update_mining_parameters(); //mining_epoch -1 => 0
  });
  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("emergency_mint", function () {
    it("test_emergency_mint", async () => {
      await Insure.set_minter(creator.address);

      let initial_supply = await Insure.totalSupply();

      let amount = BigNumber.from("1000000");

      await Insure.emergency_mint(amount, alice.address);

      //check if minted
      expect(await Insure.emergency_minted()).to.equal(amount);
      expect(await Insure.balanceOf(alice.address)).to.equal(amount);
      expect(await Insure.totalSupply()).to.equal(initial_supply.add(amount));
    });

    it("test_available_supply", async () => {
      await Insure.set_minter(creator.address);

      expect(await Insure.mining_epoch()).to.equal(0);

      let creation_time = await Insure.start_epoch_time();
      let initial_supply = await Insure.totalSupply();
      let rate = await Insure.rate();

      let amount = BigNumber.from("1000000");
      await Insure.emergency_mint(amount, alice.address);

      await ethers.provider.send("evm_increaseTime", [WEEK]);
      let new_timestamp = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

      let expected = initial_supply.add(rate.mul(new_timestamp.sub(creation_time))).add(amount);
      expect(await Insure.available_supply()).to.equal(expected);
    });

    it("test_minter_only", async () => {
      await Insure.set_minter(creator.address);

      let amount = BigNumber.from("1000000");
      await expect(Insure.connect(alice).emergency_mint(amount, alice.address)).to.revertedWith("dev: minter only");
    });
  });
});
