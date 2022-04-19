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

  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;
  var INITIAL_SUPPLY = BigNumber.from("1303030303000000000000000000");

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const ten_to_the_21 = BigNumber.from("1000000000000000000000");
  const ten_to_the_20 = BigNumber.from("100000000000000000000");
  const ten_to_the_19 = BigNumber.from("10000000000000000000");
  const ten_to_the_18 = BigNumber.from("1000000000000000000");
  const ten_to_the_17 = BigNumber.from("100000000000000000");
  const ten_to_the_9 = BigNumber.from("1000000000");
  let a = BigNumber.from("2");
  let b = BigNumber.from("5");

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
  });
  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("test_total_weight", function () {
    it("test_total_weight", async () => {
      await gauge_controller.add_gauge(three_gauges[0], 1, GAUGE_WEIGHTS[0]);
      expect(await gauge_controller.get_total_weight()).to.equal(GAUGE_WEIGHTS[0].mul(TYPE_WEIGHTS[0]));
    });

    it("test_change_type_weight", async () => {
      await gauge_controller.add_gauge(three_gauges[0], 1, ten_to_the_18);

      await gauge_controller.change_type_weight(1, 31337);

      expect(await gauge_controller.get_total_weight()).to.equal(ten_to_the_18.mul(BigNumber.from("31337")));
    });

    it("test_change_gauge_weight", async () => {
      await gauge_controller.add_gauge(three_gauges[0], 1, ten_to_the_18);

      await gauge_controller.change_gauge_weight(three_gauges[0], 31337);

      expect(await gauge_controller.get_total_weight()).to.equal(TYPE_WEIGHTS[0].mul(BigNumber.from("31337")));
    });

    it("test_multiple", async () => {
      await gauge_controller.add_type("Insurance", TYPE_WEIGHTS[1]);
      await gauge_controller.add_gauge(three_gauges[0], 1, GAUGE_WEIGHTS[0]);
      await gauge_controller.add_gauge(three_gauges[1], 1, GAUGE_WEIGHTS[1]);
      await gauge_controller.add_gauge(three_gauges[2], 2, GAUGE_WEIGHTS[2]);

      let expected = GAUGE_WEIGHTS[0]
        .mul(TYPE_WEIGHTS[0])
        .add(GAUGE_WEIGHTS[1].mul(TYPE_WEIGHTS[0]))
        .add(GAUGE_WEIGHTS[2].mul(TYPE_WEIGHTS[1]));

      expect(await gauge_controller.get_total_weight()).to.equal(expected);
    });
  });
});
