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

  const two_to_the_256_minus_1 = BigNumber.from("2").pow(BigNumber.from("256")).sub(BigNumber.from("1"));
  const ten_to_the_21 = BigNumber.from("1000000000000000000000");
  const ten_to_the_20 = BigNumber.from("100000000000000000000");
  const ten_to_the_19 = BigNumber.from("10000000000000000000");
  const ten_to_the_18 = BigNumber.from("1000000000000000000");
  const ten_to_the_17 = BigNumber.from("100000000000000000");
  const ten_to_the_9 = BigNumber.from("1000000000");

  before(async () => {
    //import
    [creator, alice, bob] = await ethers.getSigners();
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
    mock_lp_token = await TestLP.deploy("InsureDAO LP token", "indexSURE", decimal, ten_to_the_9); //Not using the actual InsureDAO contract
    minter = await Minter.deploy(Insure.address, gauge_controller.address, ownership.address);
    liquidity_gauge = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);

    //set up
    await mock_lp_token.approve(liquidity_gauge.address, two_to_the_256_minus_1);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("test_deposit_withdraw", function () {
    it("test_deposit", async () => {
      let balance = await mock_lp_token.balanceOf(creator.address);
      await liquidity_gauge.deposit(BigNumber.from("100000"), creator.address);

      expect(await mock_lp_token.balanceOf(liquidity_gauge.address)).to.equal(BigNumber.from("100000"));
      expect(await mock_lp_token.balanceOf(creator.address)).to.equal(balance.sub(BigNumber.from("100000")));
      expect(await liquidity_gauge.totalSupply()).to.equal(BigNumber.from("100000"));
      expect(await liquidity_gauge.balanceOf(creator.address)).to.equal(BigNumber.from("100000"));
    });

    it("test_deposit_zero", async () => {
      let balance = await mock_lp_token.balanceOf(creator.address);
      await liquidity_gauge.deposit(BigNumber.from("0"), creator.address);

      expect(await mock_lp_token.balanceOf(liquidity_gauge.address)).to.equal(BigNumber.from("0"));
      expect(await mock_lp_token.balanceOf(creator.address)).to.equal(balance);
      expect(await liquidity_gauge.totalSupply()).to.equal(BigNumber.from("0"));
      expect(await liquidity_gauge.balanceOf(creator.address)).to.equal(BigNumber.from("0"));
    });

    it("test_deposit_insufficient_balance", async () => {
      await expect(liquidity_gauge.connect(alice).deposit(BigNumber.from("10000"), alice.address)).to.reverted;
    });

    it("test_withdraw", async () => {
      let balance = await mock_lp_token.balanceOf(creator.address);

      await liquidity_gauge.deposit(BigNumber.from("100000"), creator.address);
      await liquidity_gauge.withdraw(BigNumber.from("100000"));

      expect(await mock_lp_token.balanceOf(liquidity_gauge.address)).to.equal(BigNumber.from("0"));
      expect(await mock_lp_token.balanceOf(creator.address)).to.equal(balance);
      expect(await liquidity_gauge.totalSupply()).to.equal(BigNumber.from("0"));
      expect(await liquidity_gauge.balanceOf(creator.address)).to.equal(BigNumber.from("0"));
    });

    it("test_withdraw_zero", async () => {
      let balance = await mock_lp_token.balanceOf(creator.address);
      await liquidity_gauge.deposit(BigNumber.from("100000"), creator.address);
      await liquidity_gauge.withdraw(BigNumber.from("0"));

      expect(await mock_lp_token.balanceOf(liquidity_gauge.address)).to.equal(BigNumber.from("100000"));
      expect(await mock_lp_token.balanceOf(creator.address)).to.equal(balance.sub(BigNumber.from("100000")));
      expect(await liquidity_gauge.totalSupply()).to.equal(BigNumber.from("100000"));
      expect(await liquidity_gauge.balanceOf(creator.address)).to.equal(BigNumber.from("100000"));
    });

    it("test_withdraw_new_epoch", async () => {
      let balance = await mock_lp_token.balanceOf(creator.address);

      await liquidity_gauge.deposit(BigNumber.from("100000"), creator.address);
      await ethers.provider.send("evm_increaseTime", [DAY.mul("400").toNumber()]);
      await liquidity_gauge.withdraw(BigNumber.from("100000"));

      expect(await mock_lp_token.balanceOf(liquidity_gauge.address)).to.equal(BigNumber.from("0"));
      expect(await mock_lp_token.balanceOf(creator.address)).to.equal(balance);
      expect(await liquidity_gauge.totalSupply()).to.equal(BigNumber.from("0"));
      expect(await liquidity_gauge.balanceOf(creator.address)).to.equal(BigNumber.from("0"));
    });
  });
});
