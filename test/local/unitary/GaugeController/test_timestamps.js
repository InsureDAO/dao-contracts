const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("GaugeController", () => {
  let InsureToken;
  let VotingEscrow;
  let GaugeController;
  let TestLP;
  let Minter;
  let LiquidityGauge;

  const YEAR = BigNumber.from(86400 * 365);
  const WEEK = BigNumber.from(86400 * 7);

  const name = "InsureToken";
  const simbol = "Insure";
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
    const Token = await ethers.getContractFactory("InsureToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGauge");
    const TestLP = await ethers.getContractFactory("TestLP");
    const Registry = await ethers.getContractFactory("TestRegistry");
    const Minter = await ethers.getContractFactory("Minter");

    //deploy
    Insure = await Token.deploy(name, simbol);
    voting_escrow = await VotingEscrow.deploy(
      Insure.address,
      "Voting-escrowed Insure",
      "veInsure",
      "veInsure"
    );
    gauge_controller = await GaugeController.deploy(
      Insure.address,
      voting_escrow.address
    );

    mock_lp_token = await TestLP.deploy(
      "InsureDAO LP token",
      "iToken",
      decimal,
      ten_to_the_9
    ); //Not using the actual InsureDAO contract
    registry = await Registry.deploy();
    minter = await Minter.deploy(Insure.address, gauge_controller.address);

    lg1 = await LiquidityGauge.deploy(
      mock_lp_token.address,
      minter.address,
      creator.address
    );
    lg2 = await LiquidityGauge.deploy(
      mock_lp_token.address,
      minter.address,
      creator.address
    );
    lg3 = await LiquidityGauge.deploy(
      mock_lp_token.address,
      minter.address,
      creator.address
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

  describe("test_timestamp", function () {
    it("test_timestamp", async () => {
      let now = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      expect(await gauge_controller.time_total()).to.equal(
        now.add(WEEK).div(WEEK).or(BigNumber.from("0")).mul(WEEK)
      );

      for (let i = 0; i < 5; i++) {
        //await time.increase(YEAR.mul(BigNumber.from('11')).div(BigNumber.from('10')));
        let t = BigNumber.from(
          (await ethers.provider.getBlock("latest")).timestamp
        );
        await ethers.provider.send("evm_increaseTime", [
          YEAR.mul("11").div("10").toNumber(),
        ]);

        await gauge_controller.checkpoint();
        now = BigNumber.from(
          (await ethers.provider.getBlock("latest")).timestamp
        );
        expect(await gauge_controller.time_total()).to.equal(
          now.add(WEEK).div(WEEK).or(BigNumber.from("0")).mul(WEEK)
        ); //technically, blocktimestamp for this tx is "now+1", but it works fine for here because of .div(WEEK) rounds down the number.
      }
    });
  });
});
