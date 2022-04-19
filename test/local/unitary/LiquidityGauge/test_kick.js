const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("LiquidityGauge", function () {
  const YEAR = BigNumber.from(86400 * 365);
  const WEEK = BigNumber.from(86400 * 7);
  const DAY = BigNumber.from(86400);

  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const MAX_UINT256 = BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935");
  const two_to_the_256_minus_1 = BigNumber.from("2").pow(BigNumber.from("256")).sub(BigNumber.from("1"));
  const ten_to_the_21 = BigNumber.from("1000000000000000000000");
  const ten_to_the_20 = BigNumber.from("100000000000000000000");
  const ten_to_the_19 = BigNumber.from("10000000000000000000");
  const ten_to_the_18 = BigNumber.from("1000000000000000000");
  const ten_to_the_17 = BigNumber.from("100000000000000000");
  const ten_to_the_9 = BigNumber.from("1000000000");

  before(async () => {
    //import
    [creator, alice] = await ethers.getSigners();
    const Ownership = await ethers.getContractFactory("Ownership");
    const Token = await ethers.getContractFactory("InsureToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGauge");
    const TestLP = await ethers.getContractFactory("TestLP");
    const Registry = await ethers.getContractFactory("TestRegistry");
    const Minter = await ethers.getContractFactory("Minter");

    //deploy
    ownership = await Ownership.deploy();
    Insure = await Token.deploy(name, symbol, ownership.address);
    voting_escrow = await VotingEscrow.deploy(
      Insure.address,
      "Voting-escrowed Insure",
      "veInsure",
      "veInsure",
      ownership.address
    );
    gauge_controller = await GaugeController.deploy(Insure.address, voting_escrow.address, ownership.address);
    mock_lp_token = await TestLP.deploy("InsureDAO LP token", "indexSURE", decimal, ten_to_the_21); //Not using the actual InsureDAO contract
    minter = await Minter.deploy(Insure.address, gauge_controller.address, ownership.address);
    liquidity_gauge = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("test_kick", function () {
    it("test_kick", async () => {
      await ethers.provider.send("evm_increaseTime", [
        WEEK.mul(BigNumber.from("2")).add(BigNumber.from("5")).toNumber(),
      ]); //2weeks and 5sec //for BOOST_WARMUP

      await Insure.approve(voting_escrow.address, MAX_UINT256);
      let now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

      await voting_escrow.create_lock(ten_to_the_20, now.add(WEEK.mul("4")));

      await mock_lp_token.approve(liquidity_gauge.address, MAX_UINT256);
      await liquidity_gauge.deposit(ten_to_the_21, creator.address);

      expect(await liquidity_gauge.working_balances(creator.address)).to.equal(ten_to_the_21);

      await ethers.provider.send("evm_increaseTime", [WEEK.toNumber()]);

      await expect(liquidity_gauge.connect(alice).kick(creator.address)).to.revertedWith("dev: kick not allowed");

      await ethers.provider.send("evm_increaseTime", [WEEK.mul("4").toNumber()]);
      await liquidity_gauge.connect(alice).kick(creator.address);
      expect(await liquidity_gauge.working_balances(creator.address)).to.equal(ten_to_the_20.mul("4"));

      await expect(liquidity_gauge.connect(alice).kick(creator.address)).to.revertedWith("dev: kick not needed");
    });
  });
});
