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

  describe("test_gauges_weights", function () {
    it("test_add_gauges", async () => {
      await gauge_controller.add_gauge(three_gauges[0], 1, 0);
      await gauge_controller.add_gauge(three_gauges[1], 1, 0);

      expect(await gauge_controller.gauges(0)).to.equal(three_gauges[0]);
      expect(await gauge_controller.gauges(1)).to.equal(three_gauges[1]);
    });

    it("test_n_gauges", async () => {
      expect(await gauge_controller.n_gauges()).to.equal("0");

      await gauge_controller.add_gauge(three_gauges[0], 1, 0);
      await gauge_controller.add_gauge(three_gauges[1], 1, 0);

      expect(await gauge_controller.n_gauges()).to.equal("2");
    });

    it("test_n_gauges_same_gauge", async () => {
      expect(await gauge_controller.n_gauges()).to.equal("0");

      await gauge_controller.add_gauge(three_gauges[0], 1, 0);
      await expect(gauge_controller.add_gauge(three_gauges[0], 1, 0)).to.revertedWith(
        "cannot add the same gauge twice"
      );

      expect(await gauge_controller.n_gauges()).to.equal("1");
    });

    it("test_n_gauge_types", async () => {
      expect(await gauge_controller.n_gauge_types()).to.equal("2"); // unset & LiquidityGauge

      await gauge_controller.add_type("Insurance", 0);

      expect(await gauge_controller.n_gauge_types()).to.equal(BigNumber.from("3")); //unset, LiquidityGauge, Insurance
    });

    it("test_gauge_types", async () => {
      await gauge_controller.add_type("Insurance", 0);

      await gauge_controller.add_gauge(three_gauges[0], 2, 0);
      await gauge_controller.add_gauge(three_gauges[1], 1, 0);

      expect(await gauge_controller.gauge_types(three_gauges[0])).to.equal("2");
      expect(await gauge_controller.gauge_types(three_gauges[1])).to.equal("1");
    });

    it("test_gauge_weight", async () => {
      await gauge_controller.add_gauge(gauge, 1, ten_to_the_19);

      expect(await gauge_controller.get_gauge_weight(gauge)).to.equal(ten_to_the_19);
    });

    it("test_gauge_weight_as_zero", async () => {
      await gauge_controller.add_gauge(gauge, 1, 0);

      expect(await gauge_controller.get_gauge_weight(gauge)).to.equal("0");
    });

    it("test_set_gauge_weight", async () => {
      await gauge_controller.add_gauge(gauge, 1, 0);

      expect(await gauge_controller.get_gauge_weight(gauge)).to.equal("0");

      await gauge_controller.change_gauge_weight(gauge, ten_to_the_21);

      //let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
      //await ethers.provider.send("evm_setNextBlockTimestamp", [now.add(WEEK).toNumber()]); //Tomorrow+1
      //await ethers.provider.send("evm_mine");

      expect(await gauge_controller.get_gauge_weight(gauge)).to.equal(ten_to_the_21);
    });

    it("test_type_weight", async () => {
      await gauge_controller.add_type("Insurance", 0);

      expect(await gauge_controller.get_type_weight(0)).to.equal("0");
      expect(await gauge_controller.get_type_weight(1)).to.equal(TYPE_WEIGHTS[0]);
      expect(await gauge_controller.get_type_weight(2)).to.equal("0");
    });

    it("test_change_type_weight", async () => {
      await gauge_controller.add_type("Insurance", 0);

      await gauge_controller.change_type_weight(2, TYPE_WEIGHTS[1]);
      await gauge_controller.change_type_weight(1, BigNumber.from("31337"));

      expect(await gauge_controller.get_type_weight(0)).to.equal("0");
      expect(await gauge_controller.get_type_weight(1)).to.equal("31337");
      expect(await gauge_controller.get_type_weight(2)).to.equal(TYPE_WEIGHTS[1]);
    });

    it("test_relative_weight_write", async () => {
      await gauge_controller.add_type("Insurance", TYPE_WEIGHTS[1]);

      await gauge_controller.add_gauge(three_gauges[0], 1, GAUGE_WEIGHTS[0]);
      await gauge_controller.add_gauge(three_gauges[1], 1, GAUGE_WEIGHTS[1]);
      await gauge_controller.add_gauge(three_gauges[2], 2, GAUGE_WEIGHTS[2]);

      let gauge_type = [0, 0, 1];
      let total_weight = TYPE_WEIGHTS[0]
        .mul(GAUGE_WEIGHTS[0])
        .add(TYPE_WEIGHTS[0].mul(GAUGE_WEIGHTS[1]))
        .add(TYPE_WEIGHTS[1].mul(GAUGE_WEIGHTS[2]));

      await ethers.provider.send("evm_increaseTime", [WEEK.mul(2).toNumber()]);
      await ethers.provider.send("evm_mine");

      let t = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

      for (let i = 0; i < 3; i++) {
        await gauge_controller.gauge_relative_weight_write(three_gauges[i], t);
        let relative_weight = await gauge_controller.gauge_relative_weight(three_gauges[i], t);
        console.log(relative_weight);
        expect(relative_weight).to.equal(
          ten_to_the_18.mul(GAUGE_WEIGHTS[i]).mul(TYPE_WEIGHTS[gauge_type[i]]).div(total_weight)
        );
      }

      await ethers.provider.send("evm_increaseTime", [YEAR.div("2").toNumber()]);
      await ethers.provider.send("evm_mine");

      for (let i = 0; i < 3; i++) {
        await gauge_controller.gauge_relative_weight_write(three_gauges[i], t);
        let relative_weight = await gauge_controller.gauge_relative_weight(three_gauges[i], t);
        expect(relative_weight).to.equal(
          ten_to_the_18.mul(GAUGE_WEIGHTS[i]).mul(TYPE_WEIGHTS[gauge_type[i]]).div(total_weight)
        );
      }

      await ethers.provider.send("evm_increaseTime", [YEAR.div("10").toNumber()]);
      await ethers.provider.send("evm_mine");

      for (let i = 0; i < 3; i++) {
        await gauge_controller.gauge_relative_weight_write(three_gauges[i], t);
        let relative_weight = await gauge_controller.gauge_relative_weight(three_gauges[i], t);
        expect(relative_weight).to.equal(
          ten_to_the_18.mul(GAUGE_WEIGHTS[i]).mul(TYPE_WEIGHTS[gauge_type[i]]).div(total_weight)
        );
      }
    });
  });
});
