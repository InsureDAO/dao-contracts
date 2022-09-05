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
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("test_deposit_for", function () {
    it("test_deposit_for", async () => {
      await mock_lp_token.approve(liquidity_gauge.address, two_to_the_256_minus_1);
      let balance = await mock_lp_token.balanceOf(creator.address);

      await liquidity_gauge.connect(alice).set_approve_deposit(creator.address, true);
      await liquidity_gauge.deposit(BigNumber.from("100000"), alice.address);

      expect(await mock_lp_token.balanceOf(liquidity_gauge.address)).to.equal(BigNumber.from("100000"));
      expect(await mock_lp_token.balanceOf(creator.address)).to.equal(balance.sub(BigNumber.from("100000")));
      expect(await liquidity_gauge.totalSupply()).to.equal(BigNumber.from("100000"));
      expect(await liquidity_gauge.balanceOf(alice.address)).to.equal(BigNumber.from("100000"));
    });

    it("test_set_approve_deposit", async () => {
      expect(await liquidity_gauge.approved_to_deposit(creator.address, alice.address)).to.equal(false);

      await liquidity_gauge.connect(alice).set_approve_deposit(creator.address, true);
      expect(await liquidity_gauge.approved_to_deposit(creator.address, alice.address)).to.equal(true);

      await liquidity_gauge.connect(alice).set_approve_deposit(creator.address, false);
      expect(await liquidity_gauge.approved_to_deposit(creator.address, alice.address)).to.equal(false);
    });

    it("test_not_approved", async () => {
      await mock_lp_token.approve(liquidity_gauge.address, two_to_the_256_minus_1);

      await expect(liquidity_gauge.deposit(100000, alice.address)).to.revertedWith("Not approved");
    });
  });
});
