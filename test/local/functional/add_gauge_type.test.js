const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const YEAR = BigNumber.from(86400 * 365);
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

describe("GaugeController", function () {
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
  const GAUGE_WEIGHTS = [
    ten_to_the_18.mul(a),
    ten_to_the_18,
    ten_to_the_17.mul(b),
  ];

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
    gauge_controller = await GaugeController.deploy(
      Insure.address,
      voting_escrow.address,
      ownership.address
    );

    mock_lp_token = await TestLP.deploy(
      "InsureDAO LP token",
      "iToken",
      decimal,
      ten_to_the_9
    ); //Not using the actual InsureDAO contract
    minter = await Minter.deploy(Insure.address, gauge_controller.address, ownership.address);

    lg1 = await LiquidityGauge.deploy(
      mock_lp_token.address,
      minter.address,
      ownership.address
    );
    lg2 = await LiquidityGauge.deploy(
      mock_lp_token.address,
      minter.address,
      ownership.address
    );
    lg3 = await LiquidityGauge.deploy(
      mock_lp_token.address,
      minter.address,
      ownership.address
    );
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

    it.skip("test_add_type_afterword", async() => {
      await gauge_controller.add_gauge(lg1.address, 1, ten_to_the_19);

      //1: 0
      console.log((await gauge_controller.gauge_relative_weight(lg1.address, 0)).toString())

      await moveForwardPeriods(7)

      await gauge_controller.checkpoint_gauge(lg1.address)

      //2: 1000000000000000000
      console.log((await gauge_controller.gauge_relative_weight(lg1.address, 0)).toString())


      //Liauidity:Single Staking = 1:4
      await gauge_controller.add_type("Single Staking", TYPE_WEIGHTS[1]);
      await gauge_controller.add_gauge(lg2.address, 2, ten_to_the_19);

      await gauge_controller.checkpoint_gauge(lg1.address)


      //Liquidity: 1000000000000000000
      console.log((await gauge_controller.gauge_relative_weight(lg1.address, 0)).toString())
      //Single Staking: 0
      console.log((await gauge_controller.gauge_relative_weight(lg2.address, 0)).toString())

      await moveForwardPeriods(7) //1週間経過
      await gauge_controller.checkpoint_gauge(lg1.address)

      //Liquidity: 200000000000000000
      console.log((await gauge_controller.gauge_relative_weight(lg1.address, 0)).toString())
      //Single Staking: 800000000000000000
      console.log((await gauge_controller.gauge_relative_weight(lg2.address, 0)).toString())

      await lg1.kill_me();
      await gauge_controller.checkpoint_gauge(lg1.address)

      console.log("killed")

      console.log((await gauge_controller.gauge_relative_weight(lg1.address, 0)).toString())
    })

    it("pause_and_start", async() => {
      await gauge_controller.add_gauge(lg1.address, 1, ten_to_the_19);

      //deposit
      let deposit_amount = BigNumber.from("1000000")
      await mock_lp_token.transfer(alice.address, deposit_amount)
      await mock_lp_token.connect(alice).approve(lg1.address, deposit_amount)
      await lg1.connect(alice).deposit(deposit_amount, alice.address)

      moveForwardPeriods(5)

      await lg1.connect(alice).user_checkpoint(alice.address)
      console.log((await lg1.integrate_fraction(alice.address)).toString())

      //pause
      await lg1.kill_me()

      await lg1.connect(alice).user_checkpoint(alice.address)
      let current = await lg1.integrate_fraction(alice.address)
      console.log("current", current.toString())

      moveForwardPeriods(2)

      await lg1.connect(alice).user_checkpoint(alice.address)
      let later = await lg1.integrate_fraction(alice.address)
      console.log("later", later.toString())

      //un-pause
      await lg1.kill_me()

      await lg1.connect(alice).user_checkpoint(alice.address)
      let unpaused = await lg1.integrate_fraction(alice.address)
      console.log(unpaused.toString())

      moveForwardPeriods(10)

      await lg1.connect(alice).user_checkpoint(alice.address)
      let unpaused_later = await lg1.integrate_fraction(alice.address)
      console.log(unpaused_later.toString())

    })
  });
});
