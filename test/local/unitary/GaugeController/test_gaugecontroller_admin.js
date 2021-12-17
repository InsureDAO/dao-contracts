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
  const simbol = "Insure";
  const decimal = 18;
  var INITIAL_SUPPLY = BigNumber.from("1303030303000000000000000000");

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const ten_to_the_21 = BigNumber.from("1000000000000000000000");
  const ten_to_the_20 = BigNumber.from("100000000000000000000");
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

    //setup
    await gauge_controller.add_type("Liquidity", TYPE_WEIGHTS[0]);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("test_gaugecontroller_admin", function () {
    it("check_deployed", async () => {
      expect(Insure.address).to.exist;
      expect(voting_escrow.address).to.exist;
      expect(gauge_controller.address).to.exist;
      expect(mock_lp_token.address).to.exist;
      expect(minter.address).to.exist;
      expect(lg1.address).to.exist;
      expect(lg2.address).to.exist;
      expect(lg3.address).to.exist;
    });

    //revert test
    it("test_commit_admin_only", async () => {
      await expect(
        gauge_controller.connect(alice).commit_transfer_ownership(alice.address)
      ).to.revertedWith("dev: admin only");
    });

    it("test_apply_admin_only", async () => {
      await expect(
        gauge_controller.connect(alice).accept_transfer_ownership()
      ).to.revertedWith("dev: future_admin only");
    });

    //test
    it("test_commit_transfer_ownership", async () => {
      await gauge_controller.commit_transfer_ownership(alice.address);

      expect(await gauge_controller.admin()).to.equal(creator.address);
      expect(await gauge_controller.future_admin()).to.equal(alice.address);
    });

    it("test_apply_transfer_ownership", async () => {
      await gauge_controller.commit_transfer_ownership(alice.address);
      await gauge_controller.connect(alice).accept_transfer_ownership();

      expect(await gauge_controller.admin()).to.equal(alice.address);
      expect(await gauge_controller.future_admin()).to.equal(alice.address);
    });
  });
});
