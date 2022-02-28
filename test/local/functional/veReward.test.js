const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const YEAR = BigNumber.from(86400 * 365);
const MONTH = BigNumber.from(86400 * 30);
const WEEK = BigNumber.from(86400 * 7);
const DAY = BigNumber.from(86400);

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

async function now() {
  return BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
}

async function moveForwardPeriods(days) {
  await ethers.provider.send("evm_increaseTime", [DAY.mul(days).toNumber()]);
  await ethers.provider.send("evm_mine");

  return true;
}

async function setNextBlock(time) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [time.toNumber()]);
}

describe("Minter", function () {

  const name = "InsureToken";
  const symbol = "INSURE";
  const decimal = 18;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const lock_amount = "1000000"

  const MAX_UINT256 = BigNumber.from(
    "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  );
  const two_to_the_256_minus_1 = BigNumber.from("2")
    .pow(BigNumber.from("256"))
    .sub(BigNumber.from("1"));
  const ten_to_the_21 = BigNumber.from("1000000000000000000000");
  const ten_to_the_20 = BigNumber.from("100000000000000000000");
  const ten_to_the_19 = BigNumber.from("10000000000000000000");
  const ten_to_the_18 = BigNumber.from("1000000000000000000");
  const ten_to_the_17 = BigNumber.from("100000000000000000");
  const ten_to_the_9 = BigNumber.from("1000000000");

  const a = BigNumber.from("5");
  const zero = BigNumber.from("0");

  const TYPE_WEIGHTS = [ten_to_the_17];
  const GAUGE_WEIGHTS = [ten_to_the_19];

  before(async () => {
    //import
    [creator, alice, bob, charly] = await ethers.getSigners();
    const Ownership = await ethers.getContractFactory("Ownership");
    const Token = await ethers.getContractFactory("InsureToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const RewardGauge = await ethers.getContractFactory("RewardGauge");
    const Minter = await ethers.getContractFactory("Minter");

    //deploy
    ownership = await Ownership.deploy();
    insure = await Token.deploy(name, symbol, ownership.address);
    voting_escrow = await VotingEscrow.deploy(
      insure.address,
      "Voting-escrowed Insure",
      "veInsure",
      "veInsure",
      ownership.address
    );
    gauge_controller = await GaugeController.deploy(
      insure.address,
      voting_escrow.address,
      ownership.address
    );

    minter = await Minter.deploy(insure.address, gauge_controller.address, ownership.address);

    gauge = await RewardGauge.deploy(
      minter.address,
      ownership.address
    );

    //--------setup--------//
    await insure.set_minter(minter.address);

    //add types
    await gauge_controller.add_type("veReward", TYPE_WEIGHTS[0]);

    //add gauges
    await gauge_controller.add_gauge(
      gauge.address,
      1,
      GAUGE_WEIGHTS[0]
    );

    //insure transfer
    await insure.transfer(alice.address, lock_amount)
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe.skip("test veReward", function () {
    it("test_mint", async () => {
      //lock
      await insure.connect(alice).approve(voting_escrow.address, lock_amount)
      let unlock_time = (await now()).add(YEAR)
      await voting_escrow.connect(alice).create_lock(lock_amount, unlock_time)

      //checkpoint
      await gauge.connect(alice).user_checkpoint(alice.address);
      await moveForwardPeriods(30)

      expect(await insure.balanceOf(alice.address)).to.equal(zero)
      await minter.connect(alice).mint(gauge.address);
      expect(await insure.balanceOf(alice.address)).to.not.equal(zero)
      
    });
  });
});
