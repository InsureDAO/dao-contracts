const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("GaugeController", function () {
  let InsureToken;
  let VotingEscrow;
  let GaugeController;
  let TestLP;
  let Minter;
  let LiquidityGauge;

  const YEAR = BigNumber.from(86400 * 365);
  const WEEK = BigNumber.from(86400 * 7);
  const DAY = BigNumber.from(86400);

  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;
  var INITIAL_SUPPLY = BigNumber.from("1303030303000000000000000000");

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const ten_to_the_24 = BigNumber.from("1000000000000000000000000");
  const ten_to_the_21 = BigNumber.from("1000000000000000000000");
  const ten_to_the_20 = BigNumber.from("100000000000000000000");
  const ten_to_the_19 = BigNumber.from("10000000000000000000");
  const ten_to_the_18 = BigNumber.from("1000000000000000000");
  const ten_to_the_17 = BigNumber.from("100000000000000000");
  const ten_to_the_9 = BigNumber.from("1000000000");
  let a = BigNumber.from("2");
  let b = BigNumber.from("5");
  let zero = BigNumber.from("0");

  const TYPE_WEIGHTS = [ten_to_the_17.mul(b), ten_to_the_18.mul(a)];
  const GAUGE_WEIGHTS = [ten_to_the_18.mul(a), ten_to_the_18, ten_to_the_17.mul(b)];

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

    mock_lp_token = await TestLP.deploy("InsureDAO LP token", "iToken", decimal, ten_to_the_9); //Not using the actual InsureDAO contract
    minter = await Minter.deploy(Insure.address, gauge_controller.address, ownership.address);

    lg1 = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);
    lg2 = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);
    lg3 = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);
    three_gauges = [lg1.address, lg2.address, lg3.address];
    gauge = three_gauges[0];

    //setup
    await gauge_controller.add_type("Liquidity", TYPE_WEIGHTS[0]);
    await gauge_controller.add_type("Insurance", 0);

    await gauge_controller.add_gauge(three_gauges[0], 1, 0);
    await gauge_controller.add_gauge(three_gauges[1], 2, 0);

    await Insure.approve(voting_escrow.address, ten_to_the_24);
    await voting_escrow.create_lock(
      ten_to_the_24,
      BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).add(YEAR)
    );
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("test_vote", function () {
    it("test_vote", async () => {
      await gauge_controller.vote_for_gauge_weights(three_gauges[0], 10000);
      expect(await gauge_controller.vote_user_power(creator.address)).to.equal(BigNumber.from("10000")); //Total vote power used by user
    });

    it("test_vote_partial", async () => {
      await gauge_controller.vote_for_gauge_weights(three_gauges[1], 1234);
      expect(await gauge_controller.vote_user_power(creator.address)).to.equal(BigNumber.from("1234"));
    });

    it("test_vote_change", async () => {
      await gauge_controller.vote_for_gauge_weights(three_gauges[1], 1234);
      await expect(gauge_controller.vote_for_gauge_weights(three_gauges[1], 1234)).to.revertedWith(
        "Cannot vote so often"
      );

      await ethers.provider.send("evm_increaseTime", [DAY.mul("10").toNumber()]);

      await gauge_controller.vote_for_gauge_weights(three_gauges[1], 42);

      expect(await gauge_controller.vote_user_power(creator.address)).to.equal(BigNumber.from("42"));
    });

    it("test_vote_remove", async () => {
      await gauge_controller.vote_for_gauge_weights(three_gauges[1], 10000);
      await expect(gauge_controller.vote_for_gauge_weights(three_gauges[1], 1234)).to.revertedWith(
        "Cannot vote so often"
      );

      await ethers.provider.send("evm_increaseTime", [DAY.mul("10").toNumber()]);
      await gauge_controller.vote_for_gauge_weights(three_gauges[1], 0);

      expect(await gauge_controller.vote_user_power(creator.address)).to.equal(zero);
    });

    it("test_vote_multiple", async () => {
      await gauge_controller.vote_for_gauge_weights(three_gauges[0], 4000);
      await gauge_controller.vote_for_gauge_weights(three_gauges[1], 6000);

      expect(await gauge_controller.vote_user_power(creator.address)).to.equal(BigNumber.from("10000"));
    });

    it("test_vote_no_balance", async () => {
      await expect(gauge_controller.connect(alice).vote_for_gauge_weights(three_gauges[0], 10000)).to.revertedWith(
        "Your token lock expires too soon"
      );
    });

    it("test_vote_expired", async () => {
      await ethers.provider.send("evm_increaseTime", [YEAR.mul("2").toNumber()]);

      await expect(gauge_controller.vote_for_gauge_weights(three_gauges[0], 10000)).to.revertedWith(
        "Your token lock expires too soon"
      );
    });

    it("test_invalid_gauge_id", async () => {
      await expect(gauge_controller.vote_for_gauge_weights(three_gauges[2], 10000)).to.revertedWith("Gauge not added");
    });

    it("test_over_user_weight", async () => {
      await expect(gauge_controller.vote_for_gauge_weights(three_gauges[0], 10001)).to.revertedWith(
        "You used all your voting power"
      );
    });

    it("test_over_weight_multiple", async () => {
      await gauge_controller.vote_for_gauge_weights(three_gauges[0], 8000);
      await expect(gauge_controller.vote_for_gauge_weights(three_gauges[1], 4000)).to.revertedWith(
        "Used too much power"
      );
    });

    it("test_over_weight_adjust_existing", async () => {
      await gauge_controller.vote_for_gauge_weights(three_gauges[0], 6000);
      await gauge_controller.vote_for_gauge_weights(three_gauges[1], 3000);

      await ethers.provider.send("evm_increaseTime", [DAY.mul("10").toNumber()]);

      await expect(gauge_controller.vote_for_gauge_weights(three_gauges[0], 8000)).to.revertedWith(
        "Used too much power"
      );
    });
  });
});
